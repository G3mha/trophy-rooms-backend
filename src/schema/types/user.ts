import { builder } from "../builder.js";
import { UserRole, AchievementTier } from "@prisma/client";
import { hasRequiredRole } from "../../context.js";

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
    role: t.expose("role", { type: UserRole }),
    achievements: t.relation("achievements", {
      query: {
        orderBy: { createdAt: "desc" },
      },
    }),
    trophies: t.relation("trophies", {
      query: {
        orderBy: { createdAt: "desc" },
      },
    }),
    achievementCount: t.relationCount("achievements"),
    trophyCount: t.relationCount("trophies"),
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

        const trophyCount = await ctx.prisma.trophy.count({
          where: { userId: user.id },
        });

        const gamesPlayed = gameFamilyIds.size;
        const completionRate = gamesPlayed > 0 ? (trophyCount / gamesPlayed) * 100 : 0;
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
