import { builder } from "../builder.js";
import {
  searchGameFamilies,
  searchBundles,
  searchDLCsFullText,
} from "../../lib/fulltext-search.js";

// Search result type enum
const SearchResultType = builder.enumType("SearchResultType", {
  values: ["GAME", "BUNDLE", "DLC"] as const,
});

// Unified search result item
const GlobalSearchItem = builder.objectRef<{
  id: string;
  type: "GAME" | "BUNDLE" | "DLC";
  title: string;
  coverUrl: string | null;
  subtitle: string | null;
}>("GlobalSearchItem");

GlobalSearchItem.implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    type: t.expose("type", { type: SearchResultType }),
    title: t.exposeString("title"),
    coverUrl: t.exposeString("coverUrl", { nullable: true }),
    subtitle: t.exposeString("subtitle", { nullable: true }),
  }),
});

// Global search results with counts
const GlobalSearchResults = builder.objectRef<{
  items: Array<{
    id: string;
    type: "GAME" | "BUNDLE" | "DLC";
    title: string;
    coverUrl: string | null;
    subtitle: string | null;
  }>;
  gameCount: number;
  bundleCount: number;
  dlcCount: number;
  totalCount: number;
}>("GlobalSearchResults");

GlobalSearchResults.implement({
  fields: (t) => ({
    items: t.field({
      type: [GlobalSearchItem],
      resolve: (parent) => parent.items,
    }),
    gameCount: t.exposeInt("gameCount"),
    bundleCount: t.exposeInt("bundleCount"),
    dlcCount: t.exposeInt("dlcCount"),
    totalCount: t.exposeInt("totalCount"),
  }),
});

// Global search query
builder.queryField("globalSearch", (t) =>
  t.field({
    type: GlobalSearchResults,
    args: {
      query: t.arg.string({ required: true }),
      limit: t.arg.int({ required: false, defaultValue: 20 }),
    },
    resolve: async (_root, { query, limit }, ctx) => {
      const searchQuery = query.trim();
      if (searchQuery.length < 2) {
        return {
          items: [],
          gameCount: 0,
          bundleCount: 0,
          dlcCount: 0,
          totalCount: 0,
        };
      }

      const searchLimit = Math.min(limit ?? 20, 50);
      const perTypeLimit = Math.ceil(searchLimit / 3);

      // Search all types in parallel
      const [gameFamilyIds, bundleIds, dlcIds] = await Promise.all([
        searchGameFamilies(ctx.prisma, searchQuery, perTypeLimit),
        searchBundles(ctx.prisma, searchQuery, perTypeLimit),
        searchDLCsFullText(ctx.prisma, searchQuery, perTypeLimit),
      ]);

      // Fetch full data for each type in parallel
      const [gameFamilies, bundles, dlcs] = await Promise.all([
        gameFamilyIds.length > 0
          ? ctx.prisma.gameFamily.findMany({
              where: { id: { in: gameFamilyIds } },
              select: { id: true, title: true, coverUrl: true, type: true },
            })
          : [],
        bundleIds.length > 0
          ? ctx.prisma.bundle.findMany({
              where: { id: { in: bundleIds } },
              select: { id: true, name: true, coverUrl: true, type: true },
            })
          : [],
        dlcIds.length > 0
          ? ctx.prisma.dLC.findMany({
              where: { id: { in: dlcIds } },
              include: {
                gameFamily: { select: { title: true } },
              },
            })
          : [],
      ]);

      // Transform to unified format
      const gameItems = gameFamilies.map((gf) => ({
        id: gf.id,
        type: "GAME" as const,
        title: gf.title,
        coverUrl: gf.coverUrl,
        subtitle: gf.type ? gf.type.replace(/_/g, " ") : null,
      }));

      const bundleItems = bundles.map((b) => ({
        id: b.id,
        type: "BUNDLE" as const,
        title: b.name,
        coverUrl: b.coverUrl,
        subtitle: b.type.replace(/_/g, " "),
      }));

      const dlcItems = dlcs.map((d) => ({
        id: d.id,
        type: "DLC" as const,
        title: d.name,
        coverUrl: d.coverUrl,
        subtitle: d.gameFamily ? `DLC for ${d.gameFamily.title}` : "DLC",
      }));

      // Combine and limit results
      const allItems = [...gameItems, ...bundleItems, ...dlcItems].slice(
        0,
        searchLimit
      );

      return {
        items: allItems,
        gameCount: gameFamilies.length,
        bundleCount: bundles.length,
        dlcCount: dlcs.length,
        totalCount: allItems.length,
      };
    },
  })
);
