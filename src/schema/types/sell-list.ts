import { builder, MutationErrorRef } from "../builder.js";
import {
  ItemCondition as PrismaItemCondition,
  SellListItemStatus as PrismaSellListItemStatus,
} from "@prisma/client";
import { ErrorCode } from "../../lib/errors.js";

// Register the ItemCondition enum
export const ItemCondition = builder.enumType(PrismaItemCondition, {
  name: "ItemCondition",
});

// Register the SellListItemStatus enum
export const SellListItemStatus = builder.enumType(PrismaSellListItemStatus, {
  name: "SellListItemStatus",
});

builder.prismaObject("SellListItem", {
  fields: (t) => ({
    id: t.exposeID("id"),
    userId: t.exposeString("userId"),
    user: t.relation("user"),
    collectionItemId: t.exposeString("collectionItemId"),
    collectionItem: t.relation("collectionItem"),

    // Listing details
    askingPrice: t.exposeFloat("askingPrice", { nullable: true }),
    condition: t.expose("condition", { type: ItemCondition }),
    conditionNotes: t.exposeString("conditionNotes", { nullable: true }),
    listingUrl: t.exposeString("listingUrl", { nullable: true }),
    notes: t.exposeString("notes", { nullable: true }),

    // Status and sale info
    status: t.expose("status", { type: SellListItemStatus }),
    salePrice: t.exposeFloat("salePrice", { nullable: true }),
    soldAt: t.expose("soldAt", { type: "DateTime", nullable: true }),

    // Timestamps
    addedAt: t.expose("addedAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),

    // Computed: Get the display title from the collection item's game
    displayTitle: t.string({
      select: {
        collectionItemId: true,
      },
      resolve: async (item, _args, ctx) => {
        const collectionItem = await ctx.prisma.collectionItem.findUnique({
          where: { id: item.collectionItemId },
          select: {
            game: {
              select: {
                gameFamily: { select: { title: true } },
              },
            },
            bundle: { select: { name: true } },
            gameVersion: { select: { name: true } },
          },
        });

        if (collectionItem?.bundle) {
          return collectionItem.bundle.name;
        }

        const baseTitle = collectionItem?.game?.gameFamily?.title ?? "Unknown Game";
        if (collectionItem?.gameVersion) {
          return `${baseTitle} (${collectionItem.gameVersion.name})`;
        }
        return baseTitle;
      },
    }),

    // Computed: Get the cover URL from the collection item's game
    displayCoverUrl: t.string({
      nullable: true,
      select: {
        collectionItemId: true,
      },
      resolve: async (item, _args, ctx) => {
        const collectionItem = await ctx.prisma.collectionItem.findUnique({
          where: { id: item.collectionItemId },
          select: {
            gameVersion: { select: { coverUrl: true } },
            game: {
              select: {
                coverUrl: true,
                gameFamily: { select: { coverUrl: true } },
              },
            },
            bundle: { select: { coverUrl: true } },
          },
        });

        return (
          collectionItem?.bundle?.coverUrl ??
          collectionItem?.gameVersion?.coverUrl ??
          collectionItem?.game?.coverUrl ??
          collectionItem?.game?.gameFamily?.coverUrl ??
          null
        );
      },
    }),

    // Computed: Get the platform from the collection item
    displayPlatform: t.prismaField({
      type: "Platform",
      nullable: true,
      select: {
        collectionItemId: true,
      },
      resolve: async (_query, item, _args, ctx) => {
        const collectionItem = await ctx.prisma.collectionItem.findUnique({
          where: { id: item.collectionItemId },
          select: { platform: true },
        });
        return collectionItem?.platform ?? null;
      },
    }),
  }),
});

// Input type for adding items to sell list
export const AddToSellListInput = builder.inputType("AddToSellListInput", {
  fields: (t) => ({
    collectionItemId: t.id({ required: true }),
    askingPrice: t.float(),
    condition: t.field({ type: ItemCondition }),
    conditionNotes: t.string(),
    listingUrl: t.string(),
    notes: t.string(),
  }),
});

// Input type for updating sell list items
export const UpdateSellListItemInput = builder.inputType("UpdateSellListItemInput", {
  fields: (t) => ({
    askingPrice: t.float(),
    condition: t.field({ type: ItemCondition }),
    conditionNotes: t.string(),
    listingUrl: t.string(),
    notes: t.string(),
  }),
});

// Input type for marking as sold
export const MarkAsSoldInput = builder.inputType("MarkAsSoldInput", {
  fields: (t) => ({
    salePrice: t.float({ required: true }),
    soldAt: t.field({ type: "DateTime" }),
  }),
});

// Filter input for querying sell list
export const SellListFilterInput = builder.inputType("SellListFilterInput", {
  fields: (t) => ({
    status: t.field({ type: SellListItemStatus }),
    condition: t.field({ type: ItemCondition }),
  }),
});

// Sorting options for sell list
export const SellListOrderBy = builder.enumType("SellListOrderBy", {
  values: [
    "ADDED_AT_ASC",
    "ADDED_AT_DESC",
    "PRICE_ASC",
    "PRICE_DESC",
    "CONDITION_ASC",
    "CONDITION_DESC",
  ] as const,
});

// SellListItem mutation result type
export const SellListMutationResult = builder.objectRef<{
  success: boolean;
  sellListItemId: string | null;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("SellListMutationResult");

SellListMutationResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    sellListItem: t.prismaField({
      type: "SellListItem",
      nullable: true,
      resolve: async (query, result, _args, ctx) => {
        if (!result.sellListItemId) return null;
        return ctx.prisma.sellListItem.findUnique({
          ...query,
          where: { id: result.sellListItemId },
        });
      },
    }),
    error: t.field({
      type: MutationErrorRef,
      nullable: true,
      resolve: (result) => result.error,
    }),
  }),
});

// Stats type for sell list summary
export const SellListStats = builder.objectRef<{
  activeCount: number;
  soldCount: number;
  totalAskingValue: number;
  totalSoldValue: number;
}>("SellListStats");

SellListStats.implement({
  fields: (t) => ({
    activeCount: t.exposeInt("activeCount"),
    soldCount: t.exposeInt("soldCount"),
    totalAskingValue: t.exposeFloat("totalAskingValue"),
    totalSoldValue: t.exposeFloat("totalSoldValue"),
  }),
});
