import { GameRegion } from "@prisma/client";
import { builder } from "../builder.js";
import { GameRegionEnum } from "../types/collection-item.js";

// Region count type for stats
const RegionCount = builder.objectRef<{
  region: GameRegion;
  count: number;
}>("RegionCount");

RegionCount.implement({
  fields: (t) => ({
    region: t.expose("region", { type: GameRegionEnum }),
    count: t.exposeInt("count"),
  }),
});

// Collection stats type
const CollectionStats = builder.objectRef<{
  totalItems: number;
  sealedCount: number;
  completeCount: number;
  byRegion: { region: GameRegion; count: number }[];
}>("CollectionStats");

CollectionStats.implement({
  fields: (t) => ({
    totalItems: t.exposeInt("totalItems"),
    sealedCount: t.exposeInt("sealedCount"),
    completeCount: t.exposeInt("completeCount"),
    byRegion: t.field({
      type: [RegionCount],
      resolve: (parent) => parent.byRegion,
    }),
  }),
});

// Get user's collection with optional filters
builder.queryField("myCollection", (t) =>
  t.prismaField({
    type: ["CollectionItem"],
    args: {
      region: t.arg({ type: GameRegionEnum, required: false }),
      isSealed: t.arg.boolean({ required: false }),
      isComplete: t.arg.boolean({ required: false }),
    },
    resolve: async (query, _root, args, ctx) => {
      if (!ctx.user) {
        return [];
      }

      const where: {
        userId: string;
        region?: GameRegion;
        isSealed?: boolean;
        hasDisc?: boolean;
        hasBox?: boolean;
        hasManual?: boolean;
      } = {
        userId: ctx.user.id,
      };

      if (args.region) {
        where.region = args.region;
      }

      if (args.isSealed !== null && args.isSealed !== undefined) {
        where.isSealed = args.isSealed;
      }

      // Filter for complete items (has disc, box, and manual)
      if (args.isComplete === true) {
        where.hasDisc = true;
        where.hasBox = true;
        where.hasManual = true;
      }

      // Merge query includes with our explicit includes to ensure eager loading
      return ctx.prisma.collectionItem.findMany({
        ...query,
        where,
        orderBy: { createdAt: "desc" },
        include: {
          ...query.include,
          game: true,
          platform: true,
          gameVersion: true,
        },
      });
    },
  })
);

// Get user's collection items for a specific game
builder.queryField("myCollectionForGame", (t) =>
  t.prismaField({
    type: ["CollectionItem"],
    args: {
      gameId: t.arg.id({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      if (!ctx.user) {
        return [];
      }

      return ctx.prisma.collectionItem.findMany({
        ...query,
        where: {
          userId: ctx.user.id,
          gameId: args.gameId,
        },
        orderBy: { createdAt: "desc" },
      });
    },
  })
);

// Get collection statistics
builder.queryField("collectionStats", (t) =>
  t.field({
    type: CollectionStats,
    resolve: async (_root, _args, ctx) => {
      if (!ctx.user) {
        return {
          totalItems: 0,
          sealedCount: 0,
          completeCount: 0,
          byRegion: [],
        };
      }

      const userId = ctx.user.id;

      // Run all queries in parallel for better performance
      const [totalItems, sealedCount, completeCount, regionCounts] = await Promise.all([
        ctx.prisma.collectionItem.count({
          where: { userId },
        }),
        ctx.prisma.collectionItem.count({
          where: { userId, isSealed: true },
        }),
        ctx.prisma.collectionItem.count({
          where: {
            userId,
            hasDisc: true,
            hasBox: true,
            hasManual: true,
          },
        }),
        ctx.prisma.collectionItem.groupBy({
          by: ["region"],
          where: { userId },
          _count: { id: true },
        }),
      ]);

      const byRegion = regionCounts.map((rc) => ({
        region: rc.region,
        count: rc._count.id,
      }));

      return {
        totalItems,
        sealedCount,
        completeCount,
        byRegion,
      };
    },
  })
);

// Get collection item count
builder.queryField("collectionCount", (t) =>
  t.field({
    type: "Int",
    resolve: async (_root, _args, ctx) => {
      if (!ctx.user) {
        return 0;
      }

      return ctx.prisma.collectionItem.count({
        where: { userId: ctx.user.id },
      });
    },
  })
);
