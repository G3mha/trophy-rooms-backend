import { builder } from "../builder.js";
import { UserRole, AchievementTier } from "@prisma/client";

builder.enumType(UserRole, {
  name: "UserRole",
});

// User stats object for detailed statistics
const UserStats = builder.objectRef<{
  totalPoints: number;
  goldCount: number;
  silverCount: number;
  bronzeCount: number;
  completionRate: number;
  averagePointsPerGame: number;
}>("UserStats");

UserStats.implement({
  fields: (t) => ({
    totalPoints: t.exposeInt("totalPoints"),
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
    email: t.exposeString("email"),
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
    // Count of unique games where user has at least one achievement
    gamesWithAchievementsCount: t.int({
      resolve: async (user, _args, ctx) => {
        const result = await ctx.prisma.userAchievement.findMany({
          where: { userId: user.id },
          select: {
            achievement: {
              select: {
                achievementSet: {
                  select: { gameId: true },
                },
              },
            },
          },
        });
        const uniqueGameIds = new Set(
          result.map((r) => r.achievement.achievementSet.gameId)
        );
        return uniqueGameIds.size;
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
                  select: { gameId: true },
                },
              },
            },
          },
        });

        let totalPoints = 0;
        let goldCount = 0;
        let silverCount = 0;
        let bronzeCount = 0;
        const gameIds = new Set<string>();

        for (const ua of userAchievements) {
          totalPoints += ua.achievement.points;
          gameIds.add(ua.achievement.achievementSet.gameId);

          switch (ua.achievement.tier) {
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

        const gamesPlayed = gameIds.size;
        const completionRate = gamesPlayed > 0 ? (trophyCount / gamesPlayed) * 100 : 0;
        const averagePointsPerGame = gamesPlayed > 0 ? totalPoints / gamesPlayed : 0;

        return {
          totalPoints,
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
