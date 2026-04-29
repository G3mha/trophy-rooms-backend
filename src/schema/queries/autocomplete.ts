import { builder } from "../builder.js";
import {
  CachePrefix,
  CacheTTL,
  cacheKey,
  getCachedOrCompute,
} from "../../lib/cache.js";
import {
  searchAchievementsFullText,
  searchGames,
} from "../../lib/fulltext-search.js";

function sortByIdOrder<T extends { id: string }>(items: T[], ids: string[]): T[] {
  const positions = new Map(ids.map((id, index) => [id, index]));

  return [...items].sort(
    (left, right) =>
      (positions.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
      (positions.get(right.id) ?? Number.MAX_SAFE_INTEGER)
  );
}

// ============================================
// AUTOCOMPLETE RESULT TYPES
// ============================================

const AutocompleteItem = builder.objectRef<{
  id: string;
  title: string;
  subtitle: string | null;
  type: "game" | "achievement";
}>("AutocompleteItem");

AutocompleteItem.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    title: t.exposeString("title"),
    subtitle: t.exposeString("subtitle", { nullable: true }),
    type: t.exposeString("type"),
  }),
});

// ============================================
// GAME AUTOCOMPLETE
// ============================================

const GameAutocompleteItem = builder.objectRef<{
  id: string;
  title: string;
  platformName: string | null;
  coverUrl: string | null;
}>("GameAutocompleteItem");

GameAutocompleteItem.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    title: t.exposeString("title"),
    platformName: t.exposeString("platformName", { nullable: true }),
    coverUrl: t.exposeString("coverUrl", { nullable: true }),
  }),
});

builder.queryField("autocompleteGames", (t) =>
  t.field({
    type: [GameAutocompleteItem],
    args: {
      query: t.arg.string({ required: true }),
      limit: t.arg.int({ required: false, defaultValue: 10 }),
    },
    resolve: async (_root, args, ctx) => {
      const query = args.query.trim();
      if (query.length < 2) return []; // Require at least 2 characters

      const limit = Math.min(args.limit ?? 10, 20); // Cap at 20
      const key = cacheKey(CachePrefix.AUTOCOMPLETE_GAMES, {
        query: query.toLowerCase(),
        limit,
      });

      return getCachedOrCompute(key, CacheTTL.AUTOCOMPLETE, async () => {
        const matchingIds = await searchGames(ctx.prisma, query, limit);
        if (matchingIds.length === 0) {
          return [];
        }

        const games = await ctx.prisma.game.findMany({
          where: { id: { in: matchingIds } },
          include: {
            gameFamily: true,
            platform: true,
          },
        });

        return sortByIdOrder(games, matchingIds).map((game) => ({
          id: game.id,
          title: game.gameFamily?.title ?? "Unknown Game",
          platformName: game.platform?.name ?? null,
          coverUrl: game.coverUrl ?? game.gameFamily?.coverUrl ?? null,
        }));
      });
    },
  })
);

// ============================================
// ACHIEVEMENT AUTOCOMPLETE
// ============================================

const AchievementAutocompleteItem = builder.objectRef<{
  id: string;
  title: string;
  gameTitle: string | null;
  iconUrl: string | null;
}>("AchievementAutocompleteItem");

AchievementAutocompleteItem.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    title: t.exposeString("title"),
    gameTitle: t.exposeString("gameTitle", { nullable: true }),
    iconUrl: t.exposeString("iconUrl", { nullable: true }),
  }),
});

builder.queryField("autocompleteAchievements", (t) =>
  t.field({
    type: [AchievementAutocompleteItem],
    args: {
      query: t.arg.string({ required: true }),
      limit: t.arg.int({ required: false, defaultValue: 10 }),
    },
    resolve: async (_root, args, ctx) => {
      const query = args.query.trim();
      if (query.length < 2) return [];

      const limit = Math.min(args.limit ?? 10, 20);
      const key = cacheKey(CachePrefix.AUTOCOMPLETE_ACHIEVEMENTS, {
        query: query.toLowerCase(),
        limit,
      });

      return getCachedOrCompute(key, CacheTTL.AUTOCOMPLETE, async () => {
        const matchingIds = await searchAchievementsFullText(ctx.prisma, query, limit);
        if (matchingIds.length === 0) {
          return [];
        }

        const achievements = await ctx.prisma.achievement.findMany({
          where: { id: { in: matchingIds } },
          include: {
            achievementSet: {
              include: {
                gameFamily: true,
              },
            },
          },
        });

        return sortByIdOrder(achievements, matchingIds).map((achievement) => ({
          id: achievement.id,
          title: achievement.title,
          gameTitle: achievement.achievementSet.gameFamily?.title ?? null,
          iconUrl: achievement.iconUrl,
        }));
      });
    },
  })
);

// ============================================
// UNIVERSAL AUTOCOMPLETE (Games + Achievements)
// ============================================

builder.queryField("autocomplete", (t) =>
  t.field({
    type: [AutocompleteItem],
    args: {
      query: t.arg.string({ required: true }),
      limit: t.arg.int({ required: false, defaultValue: 10 }),
    },
    resolve: async (_root, args, ctx) => {
      const query = args.query.trim();
      if (query.length < 2) return [];

      const limit = Math.min(args.limit ?? 10, 20);
      const halfLimit = Math.ceil(limit / 2);

      // Fetch games and achievements in parallel
      const [gameIds, achievementIds] = await Promise.all([
        searchGames(ctx.prisma, query, halfLimit),
        searchAchievementsFullText(ctx.prisma, query, halfLimit),
      ]);

      const [games, achievements] = await Promise.all([
        gameIds.length === 0
          ? []
          : ctx.prisma.game.findMany({
              where: { id: { in: gameIds } },
              include: {
                gameFamily: true,
                platform: true,
              },
            }),
        achievementIds.length === 0
          ? []
          : ctx.prisma.achievement.findMany({
              where: { id: { in: achievementIds } },
              include: {
                achievementSet: {
                  include: {
                    gameFamily: true,
                  },
                },
              },
            }),
      ]);

      const results: { id: string; title: string; subtitle: string | null; type: "game" | "achievement" }[] = [];

      // Add games
      for (const game of sortByIdOrder(games, gameIds)) {
        results.push({
          id: game.id,
          title: game.gameFamily?.title ?? "Unknown Game",
          subtitle: game.platform?.name ?? null,
          type: "game",
        });
      }

      // Add achievements
      for (const achievement of sortByIdOrder(achievements, achievementIds)) {
        results.push({
          id: achievement.id,
          title: achievement.title,
          subtitle: achievement.achievementSet.gameFamily?.title ?? null,
          type: "achievement",
        });
      }

      return results.slice(0, limit);
    },
  })
);
