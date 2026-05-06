import { BuylistPriority as PrismaBuylistPriority } from "@prisma/client";
import { builder } from "../builder.js";
import {
  BuylistFilterInput,
  BuylistOrderBy,
  BuylistStats,
} from "../types/buylist.js";

// Helper function to build order by from enum
function getOrderByFromEnum(orderBy: string | undefined | null) {
  switch (orderBy) {
    case "ADDED_AT_ASC":
      return { addedAt: "asc" as const };
    case "ADDED_AT_DESC":
      return { addedAt: "desc" as const };
    case "PRIORITY_ASC":
      return { priority: "asc" as const };
    case "PRIORITY_DESC":
      return { priority: "desc" as const };
    case "PRICE_ASC":
      return { estimatedPrice: "asc" as const };
    case "PRICE_DESC":
      return { estimatedPrice: "desc" as const };
    default:
      // Default to priority descending (HIGH first)
      return { priority: "desc" as const };
  }
}

// Get the current user's buylist
builder.queryField("myBuylist", (t) =>
  t.prismaField({
    type: ["BuylistItem"],
    args: {
      filter: t.arg({ type: BuylistFilterInput, required: false }),
      orderBy: t.arg({ type: BuylistOrderBy, required: false }),
    },
    resolve: async (query, _root, args, ctx) => {
      if (!ctx.user) {
        return [];
      }

      const { filter, orderBy } = args;

      // Build where clause
      const where: {
        userId: string;
        priority?: PrismaBuylistPriority;
        gameId?: { not: null } | null;
        dlcId?: { not: null } | null;
        bundleId?: { not: null } | null;
      } = {
        userId: ctx.user.id,
      };

      if (filter?.priority) {
        where.priority = filter.priority;
      }

      if (filter?.itemType) {
        switch (filter.itemType) {
          case "GAME":
            where.gameId = { not: null };
            where.dlcId = null;
            where.bundleId = null;
            break;
          case "DLC":
            where.dlcId = { not: null };
            break;
          case "BUNDLE":
            where.bundleId = { not: null };
            break;
        }
      }

      return ctx.prisma.buylistItem.findMany({
        ...query,
        where,
        orderBy: getOrderByFromEnum(orderBy),
      });
    },
  })
);

// Get a user's buylist (public, for sharing)
builder.queryField("userBuylist", (t) =>
  t.prismaField({
    type: ["BuylistItem"],
    args: {
      userId: t.arg.id({ required: true }),
      filter: t.arg({ type: BuylistFilterInput, required: false }),
      orderBy: t.arg({ type: BuylistOrderBy, required: false }),
    },
    resolve: async (query, _root, args, ctx) => {
      const { userId, filter, orderBy } = args;

      // Build where clause
      const where: {
        userId: string;
        priority?: PrismaBuylistPriority;
        gameId?: { not: null } | null;
        dlcId?: { not: null } | null;
        bundleId?: { not: null } | null;
      } = {
        userId,
      };

      if (filter?.priority) {
        where.priority = filter.priority;
      }

      if (filter?.itemType) {
        switch (filter.itemType) {
          case "GAME":
            where.gameId = { not: null };
            where.dlcId = null;
            where.bundleId = null;
            break;
          case "DLC":
            where.dlcId = { not: null };
            break;
          case "BUNDLE":
            where.bundleId = { not: null };
            break;
        }
      }

      return ctx.prisma.buylistItem.findMany({
        ...query,
        where,
        orderBy: getOrderByFromEnum(orderBy),
      });
    },
  })
);

// Get buylist stats for the current user
builder.queryField("buylistStats", (t) =>
  t.field({
    type: BuylistStats,
    resolve: async (_root, _args, ctx) => {
      if (!ctx.user) {
        return {
          totalItems: 0,
          totalEstimatedCost: 0,
          highPriorityCount: 0,
          mediumPriorityCount: 0,
          lowPriorityCount: 0,
          gameCount: 0,
          dlcCount: 0,
          bundleCount: 0,
        };
      }

      const items = await ctx.prisma.buylistItem.findMany({
        where: { userId: ctx.user.id },
        select: {
          priority: true,
          estimatedPrice: true,
          gameId: true,
          dlcId: true,
          bundleId: true,
        },
      });

      let totalEstimatedCost = 0;
      let highPriorityCount = 0;
      let mediumPriorityCount = 0;
      let lowPriorityCount = 0;
      let gameCount = 0;
      let dlcCount = 0;
      let bundleCount = 0;

      for (const item of items) {
        if (item.estimatedPrice) {
          totalEstimatedCost += item.estimatedPrice;
        }

        switch (item.priority) {
          case PrismaBuylistPriority.HIGH:
            highPriorityCount++;
            break;
          case PrismaBuylistPriority.MEDIUM:
            mediumPriorityCount++;
            break;
          case PrismaBuylistPriority.LOW:
            lowPriorityCount++;
            break;
        }

        if (item.bundleId) {
          bundleCount++;
        } else if (item.dlcId) {
          dlcCount++;
        } else if (item.gameId) {
          gameCount++;
        }
      }

      return {
        totalItems: items.length,
        totalEstimatedCost,
        highPriorityCount,
        mediumPriorityCount,
        lowPriorityCount,
        gameCount,
        dlcCount,
        bundleCount,
      };
    },
  })
);

// Check if an item is in the current user's buylist
builder.queryField("isInBuylist", (t) =>
  t.field({
    type: "Boolean",
    args: {
      gameId: t.arg.id({ required: false }),
      dlcId: t.arg.id({ required: false }),
      bundleId: t.arg.id({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) {
        return false;
      }

      const { gameId, dlcId, bundleId } = args;

      // Must provide exactly one
      const items = [gameId, dlcId, bundleId].filter(Boolean);
      if (items.length !== 1) {
        return false;
      }

      const count = await ctx.prisma.buylistItem.count({
        where: {
          userId: ctx.user.id,
          ...(gameId && { gameId, dlcId: null, bundleId: null }),
          ...(dlcId && { dlcId }),
          ...(bundleId && { bundleId }),
        },
      });

      return count > 0;
    },
  })
);

// Get a single buylist item by ID
builder.queryField("buylistItem", (t) =>
  t.prismaField({
    type: "BuylistItem",
    nullable: true,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      return ctx.prisma.buylistItem.findUnique({
        ...query,
        where: { id: args.id },
      });
    },
  })
);
