import { builder } from "../builder.js";

// Leaderboard entry type
const LeaderboardEntry = builder.objectRef<{
  rank: number;
  userId: string;
  userName: string | null;
  value: number;
  secondaryValue?: number;
}>("LeaderboardEntry");

LeaderboardEntry.implement({
  fields: (t) => ({
    rank: t.exposeInt("rank"),
    userId: t.exposeString("userId"),
    userName: t.exposeString("userName", { nullable: true }),
    value: t.exposeInt("value"),
    secondaryValue: t.exposeInt("secondaryValue", { nullable: true }),
  }),
});

// Fastest completion entry (includes game info)
const FastestCompletionEntry = builder.objectRef<{
  rank: number;
  userId: string;
  userName: string | null;
  gameId: string;
  gameTitle: string;
  completionTimeHours: number;
  completedAt: Date;
}>("FastestCompletionEntry");

FastestCompletionEntry.implement({
  fields: (t) => ({
    rank: t.exposeInt("rank"),
    userId: t.exposeString("userId"),
    userName: t.exposeString("userName", { nullable: true }),
    gameId: t.exposeString("gameId"),
    gameTitle: t.exposeString("gameTitle"),
    completionTimeHours: t.exposeFloat("completionTimeHours"),
    completedAt: t.expose("completedAt", { type: "DateTime" }),
  }),
});

// Top users by trophies (Platinum Trophy holders)
builder.queryField("leaderboardByTrophies", (t) =>
  t.field({
    type: [LeaderboardEntry],
    args: {
      limit: t.arg.int({ required: false, defaultValue: 10 }),
    },
    resolve: async (_root, args, ctx) => {
      const limit = Math.min(args.limit || 10, 100);

      const results = await ctx.prisma.trophy.groupBy({
        by: ["userId"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: limit,
      });

      const userIds = results.map((r) => r.userId);
      const users = await ctx.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      });

      const userMap = new Map(users.map((u) => [u.id, u]));

      // Also get achievement counts for secondary value
      const achievementCounts = await ctx.prisma.userAchievement.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds } },
        _count: { id: true },
      });
      const achievementMap = new Map(
        achievementCounts.map((a) => [a.userId, a._count.id])
      );

      return results.map((r, index) => {
        const user = userMap.get(r.userId);
        return {
          rank: index + 1,
          userId: r.userId,
          userName: user?.name || null,
          value: r._count.id,
          secondaryValue: achievementMap.get(r.userId) || 0,
        };
      });
    },
  })
);

// Top users by achievements
builder.queryField("leaderboardByAchievements", (t) =>
  t.field({
    type: [LeaderboardEntry],
    args: {
      limit: t.arg.int({ required: false, defaultValue: 10 }),
    },
    resolve: async (_root, args, ctx) => {
      const limit = Math.min(args.limit || 10, 100);

      const results = await ctx.prisma.userAchievement.groupBy({
        by: ["userId"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: limit,
      });

      const userIds = results.map((r) => r.userId);
      const users = await ctx.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      });

      const userMap = new Map(users.map((u) => [u.id, u]));

      // Get trophy counts for secondary value
      const trophyCounts = await ctx.prisma.trophy.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds } },
        _count: { id: true },
      });
      const trophyMap = new Map(
        trophyCounts.map((t) => [t.userId, t._count.id])
      );

      return results.map((r, index) => {
        const user = userMap.get(r.userId);
        return {
          rank: index + 1,
          userId: r.userId,
          userName: user?.name || null,
          value: r._count.id,
          secondaryValue: trophyMap.get(r.userId) || 0,
        };
      });
    },
  })
);

// Top users by total points
builder.queryField("leaderboardByPoints", (t) =>
  t.field({
    type: [LeaderboardEntry],
    args: {
      limit: t.arg.int({ required: false, defaultValue: 10 }),
    },
    resolve: async (_root, args, ctx) => {
      const limit = Math.min(args.limit || 10, 100);

      // Get all user achievements with points
      const userAchievements = await ctx.prisma.userAchievement.findMany({
        select: {
          userId: true,
          achievement: {
            select: { points: true },
          },
        },
      });

      // Calculate total points per user
      const pointsMap = new Map<string, number>();
      for (const ua of userAchievements) {
        const current = pointsMap.get(ua.userId) || 0;
        pointsMap.set(ua.userId, current + ua.achievement.points);
      }

      // Sort and limit
      const sortedUsers = Array.from(pointsMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      const userIds = sortedUsers.map(([userId]) => userId);
      const users = await ctx.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      });

      const userMap = new Map(users.map((u) => [u.id, u]));

      // Get achievement counts for secondary value
      const achievementCounts = await ctx.prisma.userAchievement.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds } },
        _count: { id: true },
      });
      const achievementMap = new Map(
        achievementCounts.map((a) => [a.userId, a._count.id])
      );

      return sortedUsers.map(([userId, points], index) => {
        const user = userMap.get(userId);
        return {
          rank: index + 1,
          userId,
          userName: user?.name || null,
          value: points,
          secondaryValue: achievementMap.get(userId) || 0,
        };
      });
    },
  })
);

// Fastest completions (users who got 100% fastest)
builder.queryField("fastestCompletions", (t) =>
  t.field({
    type: [FastestCompletionEntry],
    args: {
      limit: t.arg.int({ required: false, defaultValue: 10 }),
    },
    resolve: async (_root, args, ctx) => {
      const limit = Math.min(args.limit || 10, 100);

      // Get all trophies with their game info
      const trophies = await ctx.prisma.trophy.findMany({
        include: {
          user: { select: { id: true, name: true } },
          game: {
            select: {
              id: true,
              gameFamilyId: true,
              gameFamily: { select: { id: true, title: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // For each trophy, calculate time from first achievement to trophy
      const completionData: Array<{
        rank: number;
        userId: string;
        userName: string | null;
        gameId: string;
        gameTitle: string;
        completionTimeHours: number;
        completedAt: Date;
      }> = [];

      for (const trophy of trophies) {
        const gameFamilyId = trophy.game.gameFamilyId;
        if (!gameFamilyId) continue;

        // Find the first achievement for this user in this game family
        const firstAchievement = await ctx.prisma.userAchievement.findFirst({
          where: {
            userId: trophy.userId,
            achievement: {
              achievementSet: {
                gameFamilyId,
              },
            },
          },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        });

        if (firstAchievement) {
          const completionTimeMs =
            trophy.createdAt.getTime() - firstAchievement.createdAt.getTime();
          const completionTimeHours = completionTimeMs / (1000 * 60 * 60);

          // Only include if completion took at least 1 minute (to filter out data issues)
          if (completionTimeHours >= 1 / 60) {
            completionData.push({
              rank: 0,
              userId: trophy.user.id,
              userName: trophy.user.name,
              gameId: trophy.game.id,
              gameTitle: trophy.game.gameFamily?.title ?? "Unknown",
              completionTimeHours: Math.round(completionTimeHours * 10) / 10,
              completedAt: trophy.createdAt,
            });
          }
        }
      }

      // Sort by completion time (fastest first)
      completionData.sort((a, b) => a.completionTimeHours - b.completionTimeHours);

      // Take top N and assign ranks
      return completionData.slice(0, limit).map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));
    },
  })
);

// Top users by games played (unique games with at least one achievement)
builder.queryField("leaderboardByGamesPlayed", (t) =>
  t.field({
    type: [LeaderboardEntry],
    args: {
      limit: t.arg.int({ required: false, defaultValue: 10 }),
    },
    resolve: async (_root, args, ctx) => {
      const limit = Math.min(args.limit || 10, 100);

      // Get all user achievements with game family info
      const userAchievements = await ctx.prisma.userAchievement.findMany({
        select: {
          userId: true,
          achievement: {
            select: {
              achievementSet: {
                select: { gameFamilyId: true },
              },
            },
          },
        },
      });

      // Count unique game families per user
      const userGamesMap = new Map<string, Set<string>>();
      for (const ua of userAchievements) {
        const familyId = ua.achievement.achievementSet.gameFamilyId;
        if (!familyId) continue;
        if (!userGamesMap.has(ua.userId)) {
          userGamesMap.set(ua.userId, new Set());
        }
        userGamesMap.get(ua.userId)!.add(familyId);
      }

      // Sort and limit
      const sortedUsers = Array.from(userGamesMap.entries())
        .map(([userId, games]) => ({ userId, gamesCount: games.size }))
        .sort((a, b) => b.gamesCount - a.gamesCount)
        .slice(0, limit);

      const userIds = sortedUsers.map((u) => u.userId);
      const users = await ctx.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      });

      const userMap = new Map(users.map((u) => [u.id, u]));

      // Get trophy counts for secondary value
      const trophyCounts = await ctx.prisma.trophy.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds } },
        _count: { id: true },
      });
      const trophyMap = new Map(
        trophyCounts.map((t) => [t.userId, t._count.id])
      );

      return sortedUsers.map((u, index) => {
        const user = userMap.get(u.userId);
        return {
          rank: index + 1,
          userId: u.userId,
          userName: user?.name || null,
          value: u.gamesCount,
          secondaryValue: trophyMap.get(u.userId) || 0,
        };
      });
    },
  })
);
