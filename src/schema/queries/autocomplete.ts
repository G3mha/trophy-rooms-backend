import { builder } from "../builder.js";
import {
  CachePrefix,
  CacheTTL,
  cacheKey,
  getCachedOrCompute,
} from "../../lib/cache.js";
import { toTsQuery } from "../../lib/fulltext-search.js";

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
        const tsquery = toTsQuery(query);

        // Use full-text search with relevance ranking
        const results = await ctx.prisma.$queryRaw<
          { id: string; title: string; platform_name: string | null; cover_url: string | null }[]
        >`
          SELECT g.id, g.title, p.name as platform_name, g."coverUrl" as cover_url
          FROM "Game" g
          LEFT JOIN "Platform" p ON g."platformId" = p.id
          WHERE g.search_vector @@ to_tsquery('english', ${tsquery})
          ORDER BY ts_rank(g.search_vector, to_tsquery('english', ${tsquery})) DESC
          LIMIT ${limit}
        `;

        // If no full-text results, try fuzzy match
        if (results.length === 0) {
          const fuzzyResults = await ctx.prisma.$queryRaw<
            { id: string; title: string; platform_name: string | null; cover_url: string | null }[]
          >`
            SELECT g.id, g.title, p.name as platform_name, g."coverUrl" as cover_url
            FROM "Game" g
            LEFT JOIN "Platform" p ON g."platformId" = p.id
            WHERE similarity(g.title, ${query}) > 0.1
            ORDER BY similarity(g.title, ${query}) DESC
            LIMIT ${limit}
          `;

          return fuzzyResults.map((r) => ({
            id: r.id,
            title: r.title,
            platformName: r.platform_name,
            coverUrl: r.cover_url,
          }));
        }

        return results.map((r) => ({
          id: r.id,
          title: r.title,
          platformName: r.platform_name,
          coverUrl: r.cover_url,
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
        const tsquery = toTsQuery(query);

        const results = await ctx.prisma.$queryRaw<
          { id: string; title: string; game_title: string | null; icon_url: string | null }[]
        >`
          SELECT a.id, a.title, g.title as game_title, a."iconUrl" as icon_url
          FROM "Achievement" a
          JOIN "AchievementSet" s ON a."achievementSetId" = s.id
          LEFT JOIN "Game" g ON s."gameId" = g.id
          WHERE a.search_vector @@ to_tsquery('english', ${tsquery})
          ORDER BY ts_rank(a.search_vector, to_tsquery('english', ${tsquery})) DESC
          LIMIT ${limit}
        `;

        return results.map((r) => ({
          id: r.id,
          title: r.title,
          gameTitle: r.game_title,
          iconUrl: r.icon_url,
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
      const [games, achievements] = await Promise.all([
        ctx.prisma.$queryRaw<{ id: string; title: string; platform_name: string | null }[]>`
          SELECT g.id, g.title, p.name as platform_name
          FROM "Game" g
          LEFT JOIN "Platform" p ON g."platformId" = p.id
          WHERE g.search_vector @@ to_tsquery('english', ${toTsQuery(query)})
          ORDER BY ts_rank(g.search_vector, to_tsquery('english', ${toTsQuery(query)})) DESC
          LIMIT ${halfLimit}
        `,
        ctx.prisma.$queryRaw<{ id: string; title: string; game_title: string | null }[]>`
          SELECT a.id, a.title, g.title as game_title
          FROM "Achievement" a
          JOIN "AchievementSet" s ON a."achievementSetId" = s.id
          LEFT JOIN "Game" g ON s."gameId" = g.id
          WHERE a.search_vector @@ to_tsquery('english', ${toTsQuery(query)})
          ORDER BY ts_rank(a.search_vector, to_tsquery('english', ${toTsQuery(query)})) DESC
          LIMIT ${halfLimit}
        `,
      ]);

      const results: { id: string; title: string; subtitle: string | null; type: "game" | "achievement" }[] = [];

      // Add games
      for (const game of games) {
        results.push({
          id: game.id,
          title: game.title,
          subtitle: game.platform_name,
          type: "game",
        });
      }

      // Add achievements
      for (const achievement of achievements) {
        results.push({
          id: achievement.id,
          title: achievement.title,
          subtitle: achievement.game_title,
          type: "achievement",
        });
      }

      return results.slice(0, limit);
    },
  })
);
