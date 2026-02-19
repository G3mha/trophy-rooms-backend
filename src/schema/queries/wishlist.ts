import { builder } from "../builder.js";

// Wishlist item type (game with wishlist metadata)
const WishlistItem = builder.objectRef<{
  id: string;
  gameId: string;
  gameTitle: string;
  gameCoverUrl: string | null;
  gameDescription: string | null;
  achievementCount: number;
  addedAt: Date;
}>("WishlistItem");

WishlistItem.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    gameId: t.exposeString("gameId"),
    gameTitle: t.exposeString("gameTitle"),
    gameCoverUrl: t.exposeString("gameCoverUrl", { nullable: true }),
    gameDescription: t.exposeString("gameDescription", { nullable: true }),
    achievementCount: t.exposeInt("achievementCount"),
    addedAt: t.expose("addedAt", { type: "DateTime" }),
  }),
});

// Get current user's wishlist
builder.queryField("myWishlist", (t) =>
  t.field({
    type: [WishlistItem],
    resolve: async (_root, _args, ctx) => {
      if (!ctx.user) {
        return [];
      }

      const wishlistItems = await ctx.prisma.wishlist.findMany({
        where: { userId: ctx.user.id },
        orderBy: { createdAt: "desc" },
        include: {
          game: {
            select: {
              id: true,
              title: true,
              coverUrl: true,
              description: true,
              _count: {
                select: {
                  achievementSets: true,
                },
              },
            },
          },
        },
      });

      // Get achievement counts for each game
      const gameIds = wishlistItems.map((item) => item.game.id);
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

      return wishlistItems.map((item) => ({
        id: item.id,
        gameId: item.game.id,
        gameTitle: item.game.title,
        gameCoverUrl: item.game.coverUrl,
        gameDescription: item.game.description,
        achievementCount: gameAchievementMap.get(item.game.id) || 0,
        addedAt: item.createdAt,
      }));
    },
  })
);

// Check if a game is in the current user's wishlist
builder.queryField("isGameInWishlist", (t) =>
  t.field({
    type: "Boolean",
    args: {
      gameId: t.arg.id({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) {
        return false;
      }

      const existing = await ctx.prisma.wishlist.findUnique({
        where: {
          userId_gameId: {
            userId: ctx.user.id,
            gameId: args.gameId,
          },
        },
      });

      return existing !== null;
    },
  })
);

// Get wishlist count for current user
builder.queryField("wishlistCount", (t) =>
  t.field({
    type: "Int",
    resolve: async (_root, _args, ctx) => {
      if (!ctx.user) {
        return 0;
      }

      return ctx.prisma.wishlist.count({
        where: { userId: ctx.user.id },
      });
    },
  })
);
