import { builder } from "../builder.js";
import { GameStatusEnum } from "../types/user-game.js";

// Bundle a library game belongs to (for stacking compilations in the UI)
const UserGameBundleRef = builder.objectRef<{
  id: string;
  name: string;
  coverUrl: string | null;
}>("UserGameBundleRef");

UserGameBundleRef.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    name: t.exposeString("name"),
    coverUrl: t.exposeString("coverUrl", { nullable: true }),
  }),
});

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
  gameVersionId: string | null;
  gameVersionName: string | null;
  status: "BACKLOG" | "PLAYING" | "PAUSED" | "COMPLETED" | "DROPPED";
  bundles: Array<{ id: string; name: string; coverUrl: string | null }>;
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
    gameVersionId: t.exposeString("gameVersionId", { nullable: true }),
    gameVersionName: t.exposeString("gameVersionName", { nullable: true }),
    status: t.expose("status", { type: GameStatusEnum }),
    bundles: t.field({
      type: [UserGameBundleRef],
      resolve: (item) => item.bundles,
    }),
    addedAt: t.expose("addedAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

// GameStatusInfo type for getGameStatus query
const GameStatusInfo = builder.objectRef<{
  status: "BACKLOG" | "PLAYING" | "PAUSED" | "COMPLETED" | "DROPPED";
  platformId: string | null;
  gameVersionId: string | null;
}>("GameStatusInfo");

GameStatusInfo.implement({
  fields: (t) => ({
    status: t.expose("status", { type: GameStatusEnum }),
    platformId: t.exposeString("platformId", { nullable: true }),
    gameVersionId: t.exposeString("gameVersionId", { nullable: true }),
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
        gameVersionId: userGame.gameVersionId,
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
              coverUrl: true,
              gameFamilyId: true,
              gameFamily: {
                select: {
                  id: true,
                  title: true,
                  coverUrl: true,
                  description: true,
                  bundles: {
                    select: {
                      id: true,
                      name: true,
                      coverUrl: true,
                      platforms: { select: { id: true } },
                    },
                  },
                },
              },
            },
          },
          platform: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          gameVersion: {
            select: {
              id: true,
              name: true,
              coverUrl: true,
            },
          },
        },
      });

      // Get achievement counts for each game family
      const gameFamilyIds = userGames
        .map((item) => item.game.gameFamilyId)
        .filter((id): id is string => id !== null);

      const achievementCounts = await ctx.prisma.achievement.groupBy({
        by: ["achievementSetId"],
        where: {
          achievementSet: {
            gameFamilyId: { in: gameFamilyIds },
          },
        },
        _count: { id: true },
      });

      // Get achievement set to game family mapping
      const achievementSets = await ctx.prisma.achievementSet.findMany({
        where: { gameFamilyId: { in: gameFamilyIds } },
        select: { id: true, gameFamilyId: true },
      });
      const setToFamilyMap = new Map(achievementSets.map((s) => [s.id, s.gameFamilyId]));

      // Aggregate counts by game family
      const familyAchievementMap = new Map<string, number>();
      for (const count of achievementCounts) {
        const familyId = setToFamilyMap.get(count.achievementSetId);
        if (familyId) {
          familyAchievementMap.set(
            familyId,
            (familyAchievementMap.get(familyId) || 0) + count._count.id
          );
        }
      }

      return userGames.map((item) => ({
        id: item.id,
        gameId: item.game.id,
        gameTitle: item.game.gameFamily?.title ?? "Unknown",
        // The owned version's art wins over the game/family default
        gameCoverUrl:
          item.gameVersion?.coverUrl ??
          item.game.coverUrl ??
          item.game.gameFamily?.coverUrl ??
          null,
        gameDescription: item.game.gameFamily?.description ?? null,
        achievementCount: item.game.gameFamilyId ? familyAchievementMap.get(item.game.gameFamilyId) || 0 : 0,
        platformId: item.platform?.id ?? null,
        platformName: item.platform?.name ?? null,
        platformSlug: item.platform?.slug ?? null,
        gameVersionId: item.gameVersion?.id ?? null,
        gameVersionName: item.gameVersion?.name ?? null,
        status: item.status,
        bundles: (item.game.gameFamily?.bundles ?? [])
          .filter(
            (b) =>
              b.platforms.length === 0 ||
              !item.platformId ||
              b.platforms.some((p) => p.id === item.platformId)
          )
          .map((b) => ({ id: b.id, name: b.name, coverUrl: b.coverUrl })),
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
