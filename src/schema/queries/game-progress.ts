import { builder } from "../builder.js";

function computePercentComplete(earnedCount: number, totalCount: number): number {
  if (totalCount <= 0) return 0;
  return earnedCount / totalCount;
}

// User's progress on a specific game family
const UserGameProgress = builder.objectRef<{
  gameFamilyId: string;
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
    gameFamilyId: t.exposeString("gameFamilyId"),
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

// Get current user's game progress (grouped by game family)
builder.queryField("myGameProgress", (t) =>
  t.field({
    type: [UserGameProgress],
    resolve: async (_root, _args, ctx) => {
      if (!ctx.user) {
        return [];
      }

      // Get all user achievements with game family info
      const userAchievements = await ctx.prisma.userAchievement.findMany({
        where: { userId: ctx.user.id },
        include: {
          achievement: {
            include: {
              achievementSet: {
                include: {
                  gameFamily: {
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

      // Get user's trophies (linked to games, which are linked to game families)
      const userTrophies = await ctx.prisma.trophy.findMany({
        where: { userId: ctx.user.id },
        select: {
          gameId: true,
          createdAt: true,
          game: {
            select: { gameFamilyId: true },
          },
        },
      });
      // Map by gameFamilyId for trophy tracking
      const trophyMap = new Map<string, Date>();
      for (const t of userTrophies) {
        const familyId = t.game.gameFamilyId;
        if (familyId && (!trophyMap.has(familyId) || t.createdAt > trophyMap.get(familyId)!)) {
          trophyMap.set(familyId, t.createdAt);
        }
      }

      // Group by game family
      const gameFamilyMap = new Map<
        string,
        {
          gameFamilyId: string;
          gameTitle: string;
          gameCoverUrl: string | null;
          earnedIds: Set<string>;
          earnedPoints: number;
          lastActivityAt: Date;
        }
      >();

      for (const ua of userAchievements) {
        const gameFamily = ua.achievement.achievementSet.gameFamily;
        if (!gameFamily) continue;
        if (!gameFamilyMap.has(gameFamily.id)) {
          gameFamilyMap.set(gameFamily.id, {
            gameFamilyId: gameFamily.id,
            gameTitle: gameFamily.title,
            gameCoverUrl: gameFamily.coverUrl,
            earnedIds: new Set(),
            earnedPoints: 0,
            lastActivityAt: ua.createdAt,
          });
        }
        const familyData = gameFamilyMap.get(gameFamily.id)!;
        familyData.earnedIds.add(ua.achievement.id);
        familyData.earnedPoints += ua.achievement.points;
        if (ua.createdAt > familyData.lastActivityAt) {
          familyData.lastActivityAt = ua.createdAt;
        }
      }

      // Get total achievement counts and points for each game family
      const gameFamilyIds = Array.from(gameFamilyMap.keys());
      const gameFamilyTotals = await ctx.prisma.achievement.groupBy({
        by: ["achievementSetId"],
        where: {
          achievementSet: {
            gameFamilyId: { in: gameFamilyIds },
          },
        },
        _count: { id: true },
        _sum: { points: true },
      });

      // Get achievement set to game family mapping
      const achievementSets = await ctx.prisma.achievementSet.findMany({
        where: { gameFamilyId: { in: gameFamilyIds } },
        select: { id: true, gameFamilyId: true },
      });
      const setToFamilyMap = new Map(achievementSets.map((s) => [s.id, s.gameFamilyId]));

      // Aggregate totals by game family
      const familyTotalMap = new Map<string, { count: number; points: number }>();
      for (const total of gameFamilyTotals) {
        const familyId = setToFamilyMap.get(total.achievementSetId);
        if (familyId) {
          const existing = familyTotalMap.get(familyId) || { count: 0, points: 0 };
          familyTotalMap.set(familyId, {
            count: existing.count + total._count.id,
            points: existing.points + (total._sum.points || 0),
          });
        }
      }

      // Build result
      const result: Array<{
        gameFamilyId: string;
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

      for (const [familyId, data] of gameFamilyMap.entries()) {
        const totals = familyTotalMap.get(familyId) || { count: 0, points: 0 };
        const earnedCount = data.earnedIds.size;
        const totalCount = totals.count;
        const percentComplete = computePercentComplete(earnedCount, totalCount);

        result.push({
          gameFamilyId: data.gameFamilyId,
          gameTitle: data.gameTitle,
          gameCoverUrl: data.gameCoverUrl,
          earnedCount,
          totalCount,
          earnedPoints: data.earnedPoints,
          totalPoints: totals.points,
          percentComplete,
          hasTrophy: trophyMap.has(familyId),
          trophyEarnedAt: trophyMap.get(familyId) || null,
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
      // Get all user achievements with game family info
      const userAchievements = await ctx.prisma.userAchievement.findMany({
        where: { userId: args.userId },
        include: {
          achievement: {
            include: {
              achievementSet: {
                include: {
                  gameFamily: {
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
          game: {
            select: { gameFamilyId: true },
          },
        },
      });
      // Map by gameFamilyId for trophy tracking
      const trophyMap = new Map<string, Date>();
      for (const t of userTrophies) {
        const familyId = t.game.gameFamilyId;
        if (familyId && (!trophyMap.has(familyId) || t.createdAt > trophyMap.get(familyId)!)) {
          trophyMap.set(familyId, t.createdAt);
        }
      }

      // Group by game family
      const gameFamilyMap = new Map<
        string,
        {
          gameFamilyId: string;
          gameTitle: string;
          gameCoverUrl: string | null;
          earnedIds: Set<string>;
          earnedPoints: number;
          lastActivityAt: Date;
        }
      >();

      for (const ua of userAchievements) {
        const gameFamily = ua.achievement.achievementSet.gameFamily;
        if (!gameFamily) continue;
        if (!gameFamilyMap.has(gameFamily.id)) {
          gameFamilyMap.set(gameFamily.id, {
            gameFamilyId: gameFamily.id,
            gameTitle: gameFamily.title,
            gameCoverUrl: gameFamily.coverUrl,
            earnedIds: new Set(),
            earnedPoints: 0,
            lastActivityAt: ua.createdAt,
          });
        }
        const familyData = gameFamilyMap.get(gameFamily.id)!;
        familyData.earnedIds.add(ua.achievement.id);
        familyData.earnedPoints += ua.achievement.points;
        if (ua.createdAt > familyData.lastActivityAt) {
          familyData.lastActivityAt = ua.createdAt;
        }
      }

      // Get total achievement counts and points for each game family
      const gameFamilyIds = Array.from(gameFamilyMap.keys());
      const gameFamilyTotals = await ctx.prisma.achievement.groupBy({
        by: ["achievementSetId"],
        where: {
          achievementSet: {
            gameFamilyId: { in: gameFamilyIds },
          },
        },
        _count: { id: true },
        _sum: { points: true },
      });

      // Get achievement set to game family mapping
      const achievementSets = await ctx.prisma.achievementSet.findMany({
        where: { gameFamilyId: { in: gameFamilyIds } },
        select: { id: true, gameFamilyId: true },
      });
      const setToFamilyMap = new Map(achievementSets.map((s) => [s.id, s.gameFamilyId]));

      // Aggregate totals by game family
      const familyTotalMap = new Map<string, { count: number; points: number }>();
      for (const total of gameFamilyTotals) {
        const familyId = setToFamilyMap.get(total.achievementSetId);
        if (familyId) {
          const existing = familyTotalMap.get(familyId) || { count: 0, points: 0 };
          familyTotalMap.set(familyId, {
            count: existing.count + total._count.id,
            points: existing.points + (total._sum.points || 0),
          });
        }
      }

      // Build result
      const result: Array<{
        gameFamilyId: string;
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

      for (const [familyId, data] of gameFamilyMap.entries()) {
        const totals = familyTotalMap.get(familyId) || { count: 0, points: 0 };
        const earnedCount = data.earnedIds.size;
        const totalCount = totals.count;
        const percentComplete = computePercentComplete(earnedCount, totalCount);

        result.push({
          gameFamilyId: data.gameFamilyId,
          gameTitle: data.gameTitle,
          gameCoverUrl: data.gameCoverUrl,
          earnedCount,
          totalCount,
          earnedPoints: data.earnedPoints,
          totalPoints: totals.points,
          percentComplete,
          hasTrophy: trophyMap.has(familyId),
          trophyEarnedAt: trophyMap.get(familyId) || null,
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
