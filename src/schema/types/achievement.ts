import { builder, MutationErrorRef } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";
import { POINTS_DEPRECATION } from "../deprecations.js";
import type { Context } from "../../context.js";

// How many users have the list's game in their library, in any status. Every
// trophy in a list shares the number, so it is counted once per request.
const playerCounts = new WeakMap<Context, Map<string, Promise<number>>>();

function countPlayers(ctx: Context, achievementSetId: string): Promise<number> {
  let perSet = playerCounts.get(ctx);
  if (!perSet) playerCounts.set(ctx, (perSet = new Map()));
  let count = perSet.get(achievementSetId);
  if (!count) {
    count = ctx.prisma.userGame
      .findMany({
        where: { game: { gameFamily: { achievementSets: { some: { id: achievementSetId } } } } },
        distinct: ["userId"],
        select: { userId: true },
      })
      .then((players) => players.length);
    perSet.set(achievementSetId, count);
  }
  return count;
}

// Null when nobody has the game in their library. Capped at 100 because a
// user can tick a trophy without adding the game. One decimal place.
export function earnedPercent(earners: number, players: number): number | null {
  if (players === 0) return null;
  return Math.min(100, Math.round((earners / players) * 1000) / 10);
}

// AchievementTier enum for GraphQL
export const AchievementTierEnum = builder.enumType("AchievementTier", {
  values: ["BRONZE", "SILVER", "GOLD", "PLATINUM"] as const,
});

builder.prismaObject("Achievement", {
  fields: (t) => ({
    id: t.exposeID("id"),
    title: t.exposeString("title"),
    description: t.exposeString("description", { nullable: true }),
    iconUrl: t.exposeString("iconUrl", { nullable: true }),
    points: t.exposeInt("points", { deprecationReason: POINTS_DEPRECATION }),
    tier: t.expose("tier", { type: AchievementTierEnum }),
    achievementSet: t.relation("achievementSet"),
    achievementSetId: t.exposeString("achievementSetId"),
    userCount: t.relationCount("users"),
    // Share of the users with this game in their library who earned the trophy
    earnedPercent: t.float({
      nullable: true,
      select: { achievementSetId: true, _count: { select: { users: true } } },
      resolve: async (achievement, _args, ctx) =>
        earnedPercent(achievement._count.users, await countPlayers(ctx, achievement.achievementSetId)),
    }),
    // Contextual field: whether the current user has completed this achievement
    isCompleted: t.boolean({
      resolve: async (achievement, _args, ctx) => {
        if (!ctx.user) return false;
        const userAchievement = await ctx.prisma.userAchievement.findUnique({
          where: {
            userId_achievementId: {
              userId: ctx.user.id,
              achievementId: achievement.id,
            },
          },
        });
        return !!userAchievement;
      },
    }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

// Input types for achievement mutations
export const CreateAchievementInput = builder.inputType(
  "CreateAchievementInput",
  {
    fields: (t) => ({
      title: t.string({ required: true }),
      description: t.string(),
      iconUrl: t.string(),
      points: t.int({ required: false, defaultValue: 0, deprecationReason: POINTS_DEPRECATION }),
      tier: t.field({ type: AchievementTierEnum, required: false }),
      achievementSetId: t.id({ required: true }),
    }),
  }
);

export const UpdateAchievementInput = builder.inputType(
  "UpdateAchievementInput",
  {
    fields: (t) => ({
      title: t.string(),
      description: t.string(),
      iconUrl: t.string(),
      points: t.int({ deprecationReason: POINTS_DEPRECATION }),
      tier: t.field({ type: AchievementTierEnum, required: false }),
    }),
  }
);

export const BulkAchievementInput = builder.inputType("BulkAchievementInput", {
  fields: (t) => ({
    title: t.string({ required: true }),
    description: t.string(),
    iconUrl: t.string(),
    points: t.int({ deprecationReason: POINTS_DEPRECATION }),
    tier: t.field({ type: AchievementTierEnum, required: false }),
  }),
});

export const BulkAchievementResult = builder.objectRef<{
  success: boolean;
  createdCount: number;
  skippedCount: number;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("BulkAchievementResult");

BulkAchievementResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    createdCount: t.exposeInt("createdCount"),
    skippedCount: t.exposeInt("skippedCount"),
    error: t.field({
      type: MutationErrorRef,
      nullable: true,
      resolve: (result) => result.error,
    }),
  }),
});

// Filter input for achievements query
export const AchievementsFilterInput = builder.inputType(
  "AchievementsFilterInput",
  {
    fields: (t) => ({
      search: t.string(),
      gameFamilyId: t.id(),
      achievementSetId: t.id(),
      onlyCompleted: t.boolean(),
      onlyIncomplete: t.boolean(),
    }),
  }
);

// Order by enum for achievements
export const AchievementOrderBy = builder.enumType("AchievementOrderBy", {
  values: [
    "TITLE_ASC",
    "TITLE_DESC",
    "CREATED_AT_ASC",
    "CREATED_AT_DESC",
    "USER_COUNT_DESC",
  ] as const,
});

// Achievement mutation result type
export const AchievementMutationResult = builder.objectRef<{
  success: boolean;
  achievementId: string | null;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("AchievementMutationResult");

AchievementMutationResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    achievement: t.prismaField({
      type: "Achievement",
      nullable: true,
      resolve: async (query, result, _args, ctx) => {
        if (!result.achievementId) return null;
        return ctx.prisma.achievement.findUnique({
          ...query,
          where: { id: result.achievementId },
        });
      },
    }),
    error: t.field({
      type: MutationErrorRef,
      nullable: true,
      resolve: (result) => result.error,
    }),
  }),
});
