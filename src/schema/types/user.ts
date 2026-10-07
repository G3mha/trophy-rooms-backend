import { builder } from "../builder.js";
import { UserRole, AchievementTier } from "@prisma/client";
import { hasRequiredRole } from "../../context.js";
import { visibleSetWhere } from "../../lib/achievement-visibility.js";
import { countFinishedGames } from "../../lib/trophies.js";

builder.enumType(UserRole, {
  name: "UserRole",
});

// User stats object for detailed statistics
const UserStats = builder.objectRef<{
  totalPoints: number;
  platinumCount: number;
  goldCount: number;
  silverCount: number;
  bronzeCount: number;
  completionRate: number;
  averagePointsPerGame: number;
}>("UserStats");

UserStats.implement({
  fields: (t) => ({
    totalPoints: t.exposeInt("totalPoints"),
    platinumCount: t.exposeInt("platinumCount"),
    goldCount: t.exposeInt("goldCount"),
    silverCount: t.exposeInt("silverCount"),
    bronzeCount: t.exposeInt("bronzeCount"),
    completionRate: t.exposeFloat("completionRate"),
    averagePointsPerGame: t.exposeFloat("averagePointsPerGame"),
  }),
});

builder.prismaObject("User", {
  fields: (t) => ({
    id: t.exposeID("id"),
    // Email is PII. User is reachable from public queries (user(id:)) and
    // from public relations (Trophy.user, UserAchievement.user, ...), so the
    // field itself has to be gated rather than the queries that lead to it.
    //
    // Unauthorised callers get "" rather than null: shipped iOS builds decode
    // this into a non-optional String, and a null fails the whole decode. Once
    // the userEmail shim in ../deprecations.ts goes, this should return null.
    email: t.string({
      nullable: true,
      resolve: (user, _args, ctx) =>
        ctx.user?.id === user.id ||
        hasRequiredRole(ctx.user, UserRole.ADMIN)
          ? user.email
          : "",
    }),
    name: t.exposeString("name", { nullable: true }),
    // Role tells a caller which accounts are worth attacking, so it is gated
    // the same way email is, and for the same reason: User is reachable from
    // the public user(id:) query and from public relations, so the field has
    // to carry the check rather than the queries leading to it.
    //
    // Unauthorised callers get USER rather than null. Both shipped clients
    // decode this into a non-optional enum (Models.swift declares
    // `let role: UserRole` twice), so null would fail the whole decode.
    // USER is the least-privileged value and is what most accounts are.
    role: t.field({
      type: UserRole,
      resolve: (user, _args, ctx) =>
        ctx.user?.id === user.id || hasRequiredRole(ctx.user, UserRole.ADMIN)
          ? user.role
          : UserRole.USER,
    }),
    achievements: t.relation("achievements", {
      query: (_args, ctx) => ({
        where: { achievement: { achievementSet: visibleSetWhere(ctx.user) } },
        orderBy: { createdAt: "desc" },
      }),
    }),
    trophies: t.relation("trophies", {
      query: {
        orderBy: { createdAt: "desc" },
      },
    }),
    achievementCount: t.relationCount("achievements"),
    // Finished games, not Trophy rows: a game owned on two editions carries a
    // trophy on each (see ../../lib/trophies.js)
    trophyCount: t.int({
      resolve: async (user, _args, ctx) =>
        (await countFinishedGames(ctx.prisma, [user.id])).get(user.id) ?? 0,
    }),
    // Count of unique game families where user has at least one achievement
    gamesWithAchievementsCount: t.int({
      resolve: async (user, _args, ctx) => {
        const result = await ctx.prisma.userAchievement.findMany({
          where: { userId: user.id },
          select: {
            achievement: {
              select: {
                achievementSet: {
                  select: { gameFamilyId: true },
                },
              },
            },
          },
        });
        const uniqueFamilyIds = new Set(
          result.map((r) => r.achievement.achievementSet.gameFamilyId)
        );
        return uniqueFamilyIds.size;
      },
    }),
    // Detailed user statistics
    stats: t.field({
      type: UserStats,
      resolve: async (user, _args, ctx) => {
        const userAchievements = await ctx.prisma.userAchievement.findMany({
          where: { userId: user.id },
          select: {
            achievement: {
              select: {
                points: true,
                tier: true,
                achievementSet: {
                  select: { gameFamilyId: true },
                },
              },
            },
          },
        });

        let totalPoints = 0;
        let platinumCount = 0;
        let goldCount = 0;
        let silverCount = 0;
        let bronzeCount = 0;
        const gameFamilyIds = new Set<string>();

        for (const ua of userAchievements) {
          totalPoints += ua.achievement.points;
          const familyId = ua.achievement.achievementSet.gameFamilyId;
          if (familyId) gameFamilyIds.add(familyId);

          switch (ua.achievement.tier) {
            case AchievementTier.PLATINUM:
              platinumCount++;
              break;
            case AchievementTier.GOLD:
              goldCount++;
              break;
            case AchievementTier.SILVER:
              silverCount++;
              break;
            case AchievementTier.BRONZE:
            default:
              bronzeCount++;
              break;
          }
        }

        // Count completed families, not Trophy rows: a family carries one
        // trophy per library edition, and a trophy can outlive the
        // achievements that earned it. Only families the user has played
        // count, so the rate can't pass 100%.
        const trophies = await ctx.prisma.trophy.findMany({
          where: { userId: user.id },
          select: { game: { select: { gameFamilyId: true } } },
        });
        const completedFamilyIds = new Set(
          trophies
            .map((trophy) => trophy.game.gameFamilyId)
            .filter((id): id is string => id !== null && gameFamilyIds.has(id))
        );

        const gamesPlayed = gameFamilyIds.size;
        const completionRate =
          gamesPlayed > 0 ? (completedFamilyIds.size / gamesPlayed) * 100 : 0;
        const averagePointsPerGame = gamesPlayed > 0 ? totalPoints / gamesPlayed : 0;

        return {
          totalPoints,
          platinumCount,
          goldCount,
          silverCount,
          bronzeCount,
          completionRate: Math.round(completionRate * 10) / 10,
          averagePointsPerGame: Math.round(averagePointsPerGame),
        };
      },
    }),
    // Recent activity (last 10 achievements)
    recentAchievements: t.prismaField({
      type: ["UserAchievement"],
      resolve: async (query, user, _args, ctx) => {
        return ctx.prisma.userAchievement.findMany({
          ...query,
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 10,
        });
      },
    }),
    // Buylist relation
    buylistItems: t.relation("buylistItems", {
      query: {
        orderBy: { addedAt: "desc" },
      },
    }),
    buylistCount: t.relationCount("buylistItems"),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});
