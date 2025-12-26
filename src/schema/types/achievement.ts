import { builder, MutationErrorRef } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";

builder.prismaObject("Achievement", {
  fields: (t) => ({
    id: t.exposeID("id"),
    title: t.exposeString("title"),
    description: t.exposeString("description", { nullable: true }),
    iconUrl: t.exposeString("iconUrl", { nullable: true }),
    game: t.relation("game"),
    gameId: t.exposeString("gameId"),
    userCount: t.relationCount("users"),
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
      gameId: t.id({ required: true }),
    }),
  }
);

// Filter input for achievements query
export const AchievementsFilterInput = builder.inputType(
  "AchievementsFilterInput",
  {
    fields: (t) => ({
      search: t.string(),
      gameId: t.id(),
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
