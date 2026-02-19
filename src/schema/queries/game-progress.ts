import { builder } from "../builder.js";

// User's progress on a specific game
const UserGameProgress = builder.objectRef<{
  gameId: string;
  gameTitle: string;
  gameCoverUrl: string | null;
  earnedCount: number;
  totalCount: number;
  earnedPoints: number;
  totalPoints: number;
  percentComplete: number;
  hasTrophy: boolean;
  trophyEarnedAt: Date | null;
  lastActivityAt: Date | null;
}>("UserGameProgress");

UserGameProgress.implement({
  fields: (t) => ({
    gameId: t.exposeString("gameId"),
    gameTitle: t.exposeString("gameTitle"),
    gameCoverUrl: t.exposeString("gameCoverUrl", { nullable: true }),
    earnedCount: t.exposeInt("earnedCount"),
    totalCount: t.exposeInt("totalCount"),
    earnedPoints: t.exposeInt("earnedPoints"),
    totalPoints: t.exposeInt("totalPoints"),
    percentComplete: t.exposeFloat("percentComplete"),
    hasTrophy: t.exposeBoolean("hasTrophy"),
    trophyEarnedAt: t.expose("trophyEarnedAt", { type: "DateTime", nullable: true }),
    lastActivityAt: t.expose("lastActivityAt", { type: "DateTime", nullable: true }),
  }),
});

// Get current user's game progress
builder.queryField("myGameProgress", (t) =>
  t.field({
    type: [UserGameProgress],
    resolve: async (_root, _args, ctx) => {
      if (!ctx.user) {
        return [];
      }

      // Get all user achievements with game info
      const userAchievements = await ctx.prisma.userAchievement.findMany({
        where: { userId: ctx.user.id },
        include: {
          achievement: {
            include: {
              achievementSet: {
                include: {
                  game: {
                    select: {
                      id: true,
                      title: true,
                      coverUrl: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Get user's trophies
      const userTrophies = await ctx.prisma.trophy.findMany({
        where: { userId: ctx.user.id },
        select: {
          gameId: true,
          createdAt: true,
        },
      });
      const trophyMap = new Map(userTrophies.map((t) => [t.gameId, t.createdAt]));

      // Group by game
      const gameMap = new Map<
        string,
        {
          gameId: string;
          gameTitle: string;
          gameCoverUrl: string | null;
          earnedIds: Set<string>;
          earnedPoints: number;
          lastActivityAt: Date;
        }
      >();

      for (const ua of userAchievements) {
        const game = ua.achievement.achievementSet.game;
        if (!gameMap.has(game.id)) {
          gameMap.set(game.id, {
            gameId: game.id,
            gameTitle: game.title,
            gameCoverUrl: game.coverUrl,
            earnedIds: new Set(),
            earnedPoints: 0,
            lastActivityAt: ua.createdAt,
          });
        }
        const gameData = gameMap.get(game.id)!;
        gameData.earnedIds.add(ua.achievement.id);
        gameData.earnedPoints += ua.achievement.points;
        if (ua.createdAt > gameData.lastActivityAt) {
          gameData.lastActivityAt = ua.createdAt;
        }
      }

      // Get total achievement counts and points for each game
      const gameIds = Array.from(gameMap.keys());
      const gameTotals = await ctx.prisma.achievement.groupBy({
        by: ["achievementSetId"],
        where: {
          achievementSet: {
            gameId: { in: gameIds },
          },
        },
        _count: { id: true },
        _sum: { points: true },
      });

      // Get achievement set to game mapping
      const achievementSets = await ctx.prisma.achievementSet.findMany({
        where: { gameId: { in: gameIds } },
        select: { id: true, gameId: true },
      });
      const setToGameMap = new Map(achievementSets.map((s) => [s.id, s.gameId]));

      // Aggregate totals by game
      const gameTotalMap = new Map<string, { count: number; points: number }>();
      for (const total of gameTotals) {
        const gameId = setToGameMap.get(total.achievementSetId);
        if (gameId) {
          const existing = gameTotalMap.get(gameId) || { count: 0, points: 0 };
          gameTotalMap.set(gameId, {
            count: existing.count + total._count.id,
            points: existing.points + (total._sum.points || 0),
          });
        }
      }

      // Build result
      const result: Array<{
        gameId: string;
        gameTitle: string;
        gameCoverUrl: string | null;
        earnedCount: number;
        totalCount: number;
        earnedPoints: number;
        totalPoints: number;
        percentComplete: number;
        hasTrophy: boolean;
        trophyEarnedAt: Date | null;
        lastActivityAt: Date | null;
      }> = [];

      for (const [gameId, data] of gameMap.entries()) {
        const totals = gameTotalMap.get(gameId) || { count: 0, points: 0 };
        const earnedCount = data.earnedIds.size;
        const totalCount = totals.count;
        const percentComplete = totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0;

        result.push({
          gameId: data.gameId,
          gameTitle: data.gameTitle,
          gameCoverUrl: data.gameCoverUrl,
          earnedCount,
          totalCount,
          earnedPoints: data.earnedPoints,
          totalPoints: totals.points,
          percentComplete,
          hasTrophy: trophyMap.has(gameId),
          trophyEarnedAt: trophyMap.get(gameId) || null,
          lastActivityAt: data.lastActivityAt,
        });
      }

      // Sort: completed games first, then by last activity
      result.sort((a, b) => {
        if (a.hasTrophy && !b.hasTrophy) return -1;
        if (!a.hasTrophy && b.hasTrophy) return 1;
        const aTime = a.lastActivityAt?.getTime() || 0;
        const bTime = b.lastActivityAt?.getTime() || 0;
        return bTime - aTime;
      });

      return result;
    },
  })
);

// Get a specific user's game progress (for public profiles)
builder.queryField("userGameProgress", (t) =>
  t.field({
    type: [UserGameProgress],
    args: {
      userId: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      // Get all user achievements with game info
      const userAchievements = await ctx.prisma.userAchievement.findMany({
        where: { userId: args.userId },
        include: {
          achievement: {
            include: {
              achievementSet: {
                include: {
                  game: {
                    select: {
                      id: true,
                      title: true,
                      coverUrl: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Get user's trophies
      const userTrophies = await ctx.prisma.trophy.findMany({
        where: { userId: args.userId },
        select: {
          gameId: true,
          createdAt: true,
        },
      });
      const trophyMap = new Map(userTrophies.map((t) => [t.gameId, t.createdAt]));

      // Group by game
      const gameMap = new Map<
        string,
        {
          gameId: string;
          gameTitle: string;
          gameCoverUrl: string | null;
          earnedIds: Set<string>;
          earnedPoints: number;
          lastActivityAt: Date;
        }
      >();

      for (const ua of userAchievements) {
        const game = ua.achievement.achievementSet.game;
        if (!gameMap.has(game.id)) {
          gameMap.set(game.id, {
            gameId: game.id,
            gameTitle: game.title,
            gameCoverUrl: game.coverUrl,
            earnedIds: new Set(),
            earnedPoints: 0,
            lastActivityAt: ua.createdAt,
          });
        }
        const gameData = gameMap.get(game.id)!;
        gameData.earnedIds.add(ua.achievement.id);
        gameData.earnedPoints += ua.achievement.points;
        if (ua.createdAt > gameData.lastActivityAt) {
          gameData.lastActivityAt = ua.createdAt;
        }
      }

      // Get total achievement counts and points for each game
      const gameIds = Array.from(gameMap.keys());
      const gameTotals = await ctx.prisma.achievement.groupBy({
        by: ["achievementSetId"],
        where: {
          achievementSet: {
            gameId: { in: gameIds },
          },
        },
        _count: { id: true },
        _sum: { points: true },
      });

      // Get achievement set to game mapping
      const achievementSets = await ctx.prisma.achievementSet.findMany({
        where: { gameId: { in: gameIds } },
        select: { id: true, gameId: true },
      });
      const setToGameMap = new Map(achievementSets.map((s) => [s.id, s.gameId]));

      // Aggregate totals by game
      const gameTotalMap = new Map<string, { count: number; points: number }>();
      for (const total of gameTotals) {
        const gameId = setToGameMap.get(total.achievementSetId);
        if (gameId) {
          const existing = gameTotalMap.get(gameId) || { count: 0, points: 0 };
          gameTotalMap.set(gameId, {
            count: existing.count + total._count.id,
            points: existing.points + (total._sum.points || 0),
          });
        }
      }

      // Build result
      const result: Array<{
        gameId: string;
        gameTitle: string;
        gameCoverUrl: string | null;
        earnedCount: number;
        totalCount: number;
        earnedPoints: number;
        totalPoints: number;
        percentComplete: number;
        hasTrophy: boolean;
        trophyEarnedAt: Date | null;
        lastActivityAt: Date | null;
      }> = [];

      for (const [gameId, data] of gameMap.entries()) {
        const totals = gameTotalMap.get(gameId) || { count: 0, points: 0 };
        const earnedCount = data.earnedIds.size;
        const totalCount = totals.count;
        const percentComplete = totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0;

        result.push({
          gameId: data.gameId,
          gameTitle: data.gameTitle,
          gameCoverUrl: data.gameCoverUrl,
          earnedCount,
          totalCount,
          earnedPoints: data.earnedPoints,
          totalPoints: totals.points,
          percentComplete,
          hasTrophy: trophyMap.has(gameId),
          trophyEarnedAt: trophyMap.get(gameId) || null,
          lastActivityAt: data.lastActivityAt,
        });
      }

      // Sort: completed games first, then by last activity
      result.sort((a, b) => {
        if (a.hasTrophy && !b.hasTrophy) return -1;
        if (!a.hasTrophy && b.hasTrophy) return 1;
        const aTime = a.lastActivityAt?.getTime() || 0;
        const bTime = b.lastActivityAt?.getTime() || 0;
        return bTime - aTime;
      });

      return result;
    },
  })
);
