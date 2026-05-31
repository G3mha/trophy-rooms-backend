import {
  SellListItemStatus as PrismaSellListItemStatus,
  ItemCondition as PrismaItemCondition,
} from "@prisma/client";
import { builder } from "../builder.js";
import {
  SellListFilterInput,
  SellListOrderBy,
  SellListStats,
} from "../types/sell-list.js";

// Helper function to build order by from enum
function getOrderByFromEnum(orderBy: string | undefined | null) {
  switch (orderBy) {
    case "ADDED_AT_ASC":
      return { addedAt: "asc" as const };
    case "ADDED_AT_DESC":
      return { addedAt: "desc" as const };
    case "PRICE_ASC":
      return { askingPrice: "asc" as const };
    case "PRICE_DESC":
      return { askingPrice: "desc" as const };
    case "CONDITION_ASC":
      return { condition: "asc" as const };
    case "CONDITION_DESC":
      return { condition: "desc" as const };
    default:
      // Default to date added descending (newest first)
      return { addedAt: "desc" as const };
  }
}

// Get the current user's sell list
builder.queryField("mySellList", (t) =>
  t.prismaField({
    type: ["SellListItem"],
    args: {
      filter: t.arg({ type: SellListFilterInput, required: false }),
      orderBy: t.arg({ type: SellListOrderBy, required: false }),
    },
    resolve: async (query, _root, args, ctx) => {
      if (!ctx.user) {
        return [];
      }

      const { filter, orderBy } = args;

      // Build where clause
      const where: {
        userId: string;
        status?: PrismaSellListItemStatus;
        condition?: PrismaItemCondition;
      } = {
        userId: ctx.user.id,
      };

      if (filter?.status) {
        where.status = filter.status;
      }

      if (filter?.condition) {
        where.condition = filter.condition;
      }

      return ctx.prisma.sellListItem.findMany({
        ...query,
        where,
        orderBy: getOrderByFromEnum(orderBy),
      });
    },
  })
);

// Get sell list stats for the current user
builder.queryField("sellListStats", (t) =>
  t.field({
    type: SellListStats,
    resolve: async (_root, _args, ctx) => {
      if (!ctx.user) {
        return {
          activeCount: 0,
          soldCount: 0,
          totalAskingValue: 0,
          totalSoldValue: 0,
        };
      }

      const items = await ctx.prisma.sellListItem.findMany({
        where: { userId: ctx.user.id },
        select: {
          status: true,
          askingPrice: true,
          salePrice: true,
        },
      });

      let activeCount = 0;
      let soldCount = 0;
      let totalAskingValue = 0;
      let totalSoldValue = 0;

      for (const item of items) {
        if (item.status === PrismaSellListItemStatus.ACTIVE) {
          activeCount++;
          if (item.askingPrice) {
            totalAskingValue += item.askingPrice;
          }
        } else if (item.status === PrismaSellListItemStatus.SOLD) {
          soldCount++;
          if (item.salePrice) {
            totalSoldValue += item.salePrice;
          }
        }
      }

      return {
        activeCount,
        soldCount,
        totalAskingValue,
        totalSoldValue,
      };
    },
  })
);

// Check if a collection item is in the current user's sell list
builder.queryField("isInSellList", (t) =>
  t.field({
    type: "Boolean",
    args: {
      collectionItemId: t.arg.id({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) {
        return false;
      }

      const count = await ctx.prisma.sellListItem.count({
        where: {
          userId: ctx.user.id,
          collectionItemId: args.collectionItemId,
          status: PrismaSellListItemStatus.ACTIVE,
        },
      });

      return count > 0;
    },
  })
);

// Get the current user's sell history (sold items)
builder.queryField("mySellHistory", (t) =>
  t.prismaField({
    type: ["SellListItem"],
    args: {
      limit: t.arg.int({ required: false }),
    },
    resolve: async (query, _root, args, ctx) => {
      if (!ctx.user) {
        return [];
      }

      return ctx.prisma.sellListItem.findMany({
        ...query,
        where: {
          userId: ctx.user.id,
          status: PrismaSellListItemStatus.SOLD,
        },
        orderBy: { soldAt: "desc" },
        take: args.limit ?? undefined,
      });
    },
  })
);

// Get a single sell list item by ID
builder.queryField("sellListItem", (t) =>
  t.prismaField({
    type: "SellListItem",
    nullable: true,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      return ctx.prisma.sellListItem.findUnique({
        ...query,
        where: { id: args.id },
      });
    },
  })
);
