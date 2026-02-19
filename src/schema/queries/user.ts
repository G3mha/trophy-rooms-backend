import { builder } from "../builder.js";

// Public user profile by ID
builder.queryField("user", (t) =>
  t.prismaField({
    type: "User",
    nullable: true,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      return ctx.prisma.user.findUnique({
        ...query,
        where: { id: args.id },
      });
    },
  })
);

// Public user achievements (paginated)
builder.queryField("userAchievements", (t) =>
  t.prismaConnection({
    type: "UserAchievement",
    cursor: "id",
    args: {
      userId: t.arg.id({ required: true }),
    },
    totalCount: (_connection, args, ctx) => {
      return ctx.prisma.userAchievement.count({
        where: { userId: args.userId },
      });
    },
    resolve: async (query, _root, args, ctx) => {
      return ctx.prisma.userAchievement.findMany({
        ...query,
        where: { userId: args.userId },
        orderBy: { createdAt: "desc" },
      });
    },
  })
);

// Public user trophies (paginated)
builder.queryField("userTrophies", (t) =>
  t.prismaConnection({
    type: "Trophy",
    cursor: "id",
    args: {
      userId: t.arg.id({ required: true }),
    },
    totalCount: (_connection, args, ctx) => {
      return ctx.prisma.trophy.count({
        where: { userId: args.userId },
      });
    },
    resolve: async (query, _root, args, ctx) => {
      return ctx.prisma.trophy.findMany({
        ...query,
        where: { userId: args.userId },
        orderBy: { createdAt: "desc" },
      });
    },
  })
);

// Current authenticated user
builder.queryField("me", (t) =>
  t.prismaField({
    type: "User",
    nullable: true,
    resolve: async (query, _root, _args, ctx) => {
      if (!ctx.user) {
        return null;
      }
      return ctx.prisma.user.findUnique({
        ...query,
        where: { id: ctx.user.id },
      });
    },
  })
);

// User's achievements (paginated)
builder.queryField("myAchievements", (t) =>
  t.prismaConnection({
    type: "UserAchievement",
    cursor: "id",
    totalCount: (_connection, _args, ctx) => {
      if (!ctx.user) return 0;
      return ctx.prisma.userAchievement.count({
        where: { userId: ctx.user.id },
      });
    },
    resolve: async (query, _root, _args, ctx) => {
      if (!ctx.user) {
        return [];
      }
      return ctx.prisma.userAchievement.findMany({
        ...query,
        where: { userId: ctx.user.id },
        orderBy: { createdAt: "desc" },
      });
    },
  })
);

// User's trophies (paginated)
builder.queryField("myTrophies", (t) =>
  t.prismaConnection({
    type: "Trophy",
    cursor: "id",
    totalCount: (_connection, _args, ctx) => {
      if (!ctx.user) return 0;
      return ctx.prisma.trophy.count({
        where: { userId: ctx.user.id },
      });
    },
    resolve: async (query, _root, _args, ctx) => {
      if (!ctx.user) {
        return [];
      }
      return ctx.prisma.trophy.findMany({
        ...query,
        where: { userId: ctx.user.id },
        orderBy: { createdAt: "desc" },
      });
    },
  })
);

// Dashboard stats for current user
const DashboardStats = builder.objectRef<{
  totalTrophies: number;
  totalAchievements: number;
  totalGamesPlayed: number;
}>("DashboardStats");

DashboardStats.implement({
  fields: (t) => ({
    totalTrophies: t.exposeInt("totalTrophies"),
    totalAchievements: t.exposeInt("totalAchievements"),
    totalGamesPlayed: t.exposeInt("totalGamesPlayed"),
  }),
});

builder.queryField("myStats", (t) =>
  t.field({
    type: DashboardStats,
    nullable: true,
    resolve: async (_root, _args, ctx) => {
      if (!ctx.user) {
        return null;
      }

      const [trophyCount, achievementCount, gamesPlayed] = await Promise.all([
        ctx.prisma.trophy.count({
          where: { userId: ctx.user.id },
        }),
        ctx.prisma.userAchievement.count({
          where: { userId: ctx.user.id },
        }),
        ctx.prisma.userAchievement
          .findMany({
            where: { userId: ctx.user.id },
            select: {
              achievement: {
                select: {
                  achievementSet: {
                    select: { gameId: true },
                  },
                },
              },
            },
          })
          .then((results) => {
            const uniqueGameIds = new Set(
              results.map((r) => r.achievement.achievementSet.gameId)
            );
            return uniqueGameIds.size;
          }),
      ]);

      return {
        totalTrophies: trophyCount,
        totalAchievements: achievementCount,
        totalGamesPlayed: gamesPlayed,
      };
    },
  })
);
