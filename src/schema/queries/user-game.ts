import { builder } from "../builder.js";
import { GameStatusEnum } from "../types/user-game.js";

// UserGame item type with game info (for listing)
const UserGameItem = builder.objectRef<{
  id: string;
  gameId: string;
  gameTitle: string;
  gameCoverUrl: string | null;
  gameDescription: string | null;
  achievementCount: number;
  platformId: string | null;
  platformName: string | null;
  platformSlug: string | null;
  status: "WISHLIST" | "BACKLOG" | "PLAYING" | "PAUSED" | "COMPLETED" | "DROPPED";
  addedAt: Date;
  updatedAt: Date;
}>("UserGameItem");

UserGameItem.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    gameId: t.exposeString("gameId"),
    gameTitle: t.exposeString("gameTitle"),
    gameCoverUrl: t.exposeString("gameCoverUrl", { nullable: true }),
    gameDescription: t.exposeString("gameDescription", { nullable: true }),
    achievementCount: t.exposeInt("achievementCount"),
    platformId: t.exposeString("platformId", { nullable: true }),
    platformName: t.exposeString("platformName", { nullable: true }),
    platformSlug: t.exposeString("platformSlug", { nullable: true }),
    status: t.expose("status", { type: GameStatusEnum }),
    addedAt: t.expose("addedAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

// GameStatusInfo type for getGameStatus query
const GameStatusInfo = builder.objectRef<{
  status: "WISHLIST" | "BACKLOG" | "PLAYING" | "PAUSED" | "COMPLETED" | "DROPPED";
  platformId: string | null;
}>("GameStatusInfo");

GameStatusInfo.implement({
  fields: (t) => ({
    status: t.expose("status", { type: GameStatusEnum }),
    platformId: t.exposeString("platformId", { nullable: true }),
  }),
});

// Get game status for a specific game
builder.queryField("getGameStatus", (t) =>
  t.field({
    type: GameStatusInfo,
    nullable: true,
    args: {
      gameId: t.arg.id({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) {
        return null;
      }

      const userGame = await ctx.prisma.userGame.findUnique({
        where: {
          userId_gameId: {
            userId: ctx.user.id,
            gameId: args.gameId,
          },
        },
      });

      if (!userGame) {
        return null;
      }

      return {
        status: userGame.status,
        platformId: userGame.platformId,
      };
    },
  })
);

// Get all games in the user's library (optionally filtered by status)
builder.queryField("myGamesByStatus", (t) =>
  t.field({
    type: [UserGameItem],
    args: {
      status: t.arg({ type: GameStatusEnum, required: false }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) {
        return [];
      }

      const userGames = await ctx.prisma.userGame.findMany({
        where: {
          userId: ctx.user.id,
          ...(args.status ? { status: args.status } : {}),
        },
        orderBy: { updatedAt: "desc" },
        include: {
          game: {
            select: {
              id: true,
              title: true,
              coverUrl: true,
              description: true,
            },
          },
          platform: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      // Get achievement counts for each game
      const gameIds = userGames.map((item) => item.game.id);

      const achievementCounts = await ctx.prisma.achievement.groupBy({
        by: ["achievementSetId"],
        where: {
          achievementSet: {
            gameId: { in: gameIds },
          },
        },
        _count: { id: true },
      });

      // Get achievement set to game mapping
      const achievementSets = await ctx.prisma.achievementSet.findMany({
        where: { gameId: { in: gameIds } },
        select: { id: true, gameId: true },
      });
      const setToGameMap = new Map(achievementSets.map((s) => [s.id, s.gameId]));

      // Aggregate counts by game
      const gameAchievementMap = new Map<string, number>();
      for (const count of achievementCounts) {
        const gameId = setToGameMap.get(count.achievementSetId);
        if (gameId) {
          gameAchievementMap.set(
            gameId,
            (gameAchievementMap.get(gameId) || 0) + count._count.id
          );
        }
      }

      return userGames.map((item) => ({
        id: item.id,
        gameId: item.game.id,
        gameTitle: item.game.title,
        gameCoverUrl: item.game.coverUrl,
        gameDescription: item.game.description,
        achievementCount: gameAchievementMap.get(item.game.id) || 0,
        platformId: item.platform?.id ?? null,
        platformName: item.platform?.name ?? null,
        platformSlug: item.platform?.slug ?? null,
        status: item.status,
        addedAt: item.createdAt,
        updatedAt: item.updatedAt,
      }));
    },
  })
);

// Get library count (total games in library)
builder.queryField("libraryCount", (t) =>
  t.field({
    type: "Int",
    resolve: async (_root, _args, ctx) => {
      if (!ctx.user) {
        return 0;
      }

      return ctx.prisma.userGame.count({
        where: { userId: ctx.user.id },
      });
    },
  })
);

// Get count by status
builder.queryField("libraryCountByStatus", (t) =>
  t.field({
    type: "Int",
    args: {
      status: t.arg({ type: GameStatusEnum, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) {
        return 0;
      }

      return ctx.prisma.userGame.count({
        where: {
          userId: ctx.user.id,
          status: args.status,
        },
      });
    },
  })
);
