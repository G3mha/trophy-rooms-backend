import { builder, MutationErrorRef } from "../builder.js";
import { BuylistPriority as PrismaBuylistPriority } from "@prisma/client";
import { ErrorCode } from "../../lib/errors.js";
import { GameRegionEnum } from "./collection-item.js";

// Register the BuylistPriority enum
export const BuylistPriority = builder.enumType(PrismaBuylistPriority, {
  name: "BuylistPriority",
});

// Enum for filtering by item type
export const BuylistItemType = builder.enumType("BuylistItemType", {
  values: ["GAME", "DLC", "BUNDLE"] as const,
});

builder.prismaObject("BuylistItem", {
  fields: (t) => ({
    id: t.exposeID("id"),
    userId: t.exposeString("userId"),
    user: t.relation("user"),

    // Item references (only one will be set)
    gameId: t.exposeString("gameId", { nullable: true }),
    game: t.relation("game", { nullable: true }),
    gameVersionId: t.exposeString("gameVersionId", { nullable: true }),
    gameVersion: t.relation("gameVersion", { nullable: true }),
    dlcId: t.exposeString("dlcId", { nullable: true }),
    dlc: t.relation("dlc", { nullable: true }),
    bundleId: t.exposeString("bundleId", { nullable: true }),
    bundle: t.relation("bundle", { nullable: true }),

    // Metadata
    priority: t.expose("priority", { type: BuylistPriority }),
    notes: t.exposeString("notes", { nullable: true }),
    estimatedPrice: t.exposeFloat("estimatedPrice", { nullable: true }),

    // Timestamps
    addedAt: t.expose("addedAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),

    // Computed fields
    itemType: t.field({
      type: BuylistItemType,
      resolve: (item) => {
        if (item.bundleId) return "BUNDLE";
        if (item.dlcId) return "DLC";
        return "GAME";
      },
    }),

    // Computed: Get the display title for this buylist item
    displayTitle: t.string({
      // Ensure these fields are included in the Prisma query for the resolver
      select: {
        gameId: true,
        dlcId: true,
        bundleId: true,
        gameVersionId: true,
        gameFamilyId: true,
      },
      resolve: async (item, _args, ctx) => {
        if (item.bundleId) {
          const bundle = await ctx.prisma.bundle.findUnique({
            where: { id: item.bundleId },
            select: { name: true },
          });
          return bundle?.name ?? "Unknown Bundle";
        }
        if (item.dlcId) {
          const dlc = await ctx.prisma.dLC.findUnique({
            where: { id: item.dlcId },
            select: { name: true },
          });
          return dlc?.name ?? "Unknown DLC";
        }
        if (item.gameId) {
          const game = await ctx.prisma.game.findUnique({
            where: { id: item.gameId },
            select: { gameFamily: { select: { title: true } } },
          });
          const baseTitle = game?.gameFamily?.title ?? "Unknown Game";
          if (item.gameVersionId) {
            const version = await ctx.prisma.gameVersion.findUnique({
              where: { id: item.gameVersionId },
              select: { name: true },
            });
            if (version) {
              return `${baseTitle} (${version.name})`;
            }
          }
          return baseTitle;
        }
        if (item.gameFamilyId) {
          const gameFamily = await ctx.prisma.gameFamily.findUnique({
            where: { id: item.gameFamilyId },
            select: { title: true },
          });
          return gameFamily?.title ?? "Unknown Game";
        }
        return "Unknown Item";
      },
    }),

    // Computed: Get the platform for this buylist item
    displayPlatform: t.prismaField({
      type: "Platform",
      nullable: true,
      select: {
        gameId: true,
        dlcId: true,
        bundleId: true,
      },
      resolve: async (_query, item, _args, ctx) => {
        if (item.gameId) {
          const game = await ctx.prisma.game.findUnique({
            where: { id: item.gameId },
            select: { platform: true },
          });
          return game?.platform ?? null;
        }
        if (item.dlcId) {
          const dlc = await ctx.prisma.dLC.findUnique({
            where: { id: item.dlcId },
            select: { platforms: { take: 1 } },
          });
          return dlc?.platforms[0] ?? null;
        }
        if (item.bundleId) {
          const bundle = await ctx.prisma.bundle.findUnique({
            where: { id: item.bundleId },
            select: { platforms: { take: 1 } },
          });
          return bundle?.platforms[0] ?? null;
        }
        return null;
      },
    }),

    // Computed: Get the cover URL for this buylist item
    displayCoverUrl: t.string({
      nullable: true,
      // Ensure these fields are included in the Prisma query for the resolver
      select: {
        gameId: true,
        dlcId: true,
        bundleId: true,
        gameVersionId: true,
        gameFamilyId: true,
      },
      resolve: async (item, _args, ctx) => {
        if (item.bundleId) {
          const bundle = await ctx.prisma.bundle.findUnique({
            where: { id: item.bundleId },
            select: { coverUrl: true },
          });
          return bundle?.coverUrl ?? null;
        }
        if (item.dlcId) {
          const dlc = await ctx.prisma.dLC.findUnique({
            where: { id: item.dlcId },
            select: { coverUrl: true, gameFamily: { select: { coverUrl: true } } },
          });
          return dlc?.coverUrl ?? dlc?.gameFamily?.coverUrl ?? null;
        }
        if (item.gameVersionId) {
          const version = await ctx.prisma.gameVersion.findUnique({
            where: { id: item.gameVersionId },
            select: {
              coverUrl: true,
              games: {
                select: {
                  coverUrl: true,
                  gameFamily: { select: { coverUrl: true } },
                },
                take: 1,
              },
            },
          });
          return (
            version?.coverUrl ??
            version?.games[0]?.coverUrl ??
            version?.games[0]?.gameFamily?.coverUrl ??
            null
          );
        }
        if (item.gameId) {
          const game = await ctx.prisma.game.findUnique({
            where: { id: item.gameId },
            select: {
              coverUrl: true,
              gameFamily: { select: { coverUrl: true } },
            },
          });
          return game?.coverUrl ?? game?.gameFamily?.coverUrl ?? null;
        }
        if (item.gameFamilyId) {
          const gameFamily = await ctx.prisma.gameFamily.findUnique({
            where: { id: item.gameFamilyId },
            select: { coverUrl: true },
          });
          return gameFamily?.coverUrl ?? null;
        }
        return null;
      },
    }),
  }),
});

// Input type for adding items to buylist
export const AddToBuylistInput = builder.inputType("AddToBuylistInput", {
  fields: (t) => ({
    // One of these must be provided
    gameId: t.id(),
    gameVersionId: t.id(), // Only valid when gameId is also provided
    dlcId: t.id(),
    bundleId: t.id(),
    // Metadata
    priority: t.field({ type: BuylistPriority }),
    notes: t.string(),
    estimatedPrice: t.float(),
  }),
});

// Input type for updating buylist items
export const UpdateBuylistItemInput = builder.inputType(
  "UpdateBuylistItemInput",
  {
    fields: (t) => ({
      priority: t.field({ type: BuylistPriority }),
      notes: t.string(),
      estimatedPrice: t.float(),
      gameVersionId: t.id(), // Can update version for game items
    }),
  }
);

// Filter input for querying buylist
export const BuylistFilterInput = builder.inputType("BuylistFilterInput", {
  fields: (t) => ({
    priority: t.field({ type: BuylistPriority }),
    itemType: t.field({ type: BuylistItemType }),
  }),
});

// Sorting options for buylist
export const BuylistOrderBy = builder.enumType("BuylistOrderBy", {
  values: [
    "ADDED_AT_ASC",
    "ADDED_AT_DESC",
    "PRIORITY_ASC",
    "PRIORITY_DESC",
    "PRICE_ASC",
    "PRICE_DESC",
  ] as const,
});

// BuylistItem mutation result type
export const BuylistMutationResult = builder.objectRef<{
  success: boolean;
  buylistItemId: string | null;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("BuylistMutationResult");

BuylistMutationResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    buylistItem: t.prismaField({
      type: "BuylistItem",
      nullable: true,
      resolve: async (query, result, _args, ctx) => {
        if (!result.buylistItemId) return null;
        return ctx.prisma.buylistItem.findUnique({
          ...query,
          where: { id: result.buylistItemId },
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

// Stats type for buylist summary
export const BuylistStats = builder.objectRef<{
  totalItems: number;
  totalEstimatedCost: number;
  highPriorityCount: number;
  mediumPriorityCount: number;
  lowPriorityCount: number;
  gameCount: number;
  dlcCount: number;
  bundleCount: number;
}>("BuylistStats");

BuylistStats.implement({
  fields: (t) => ({
    totalItems: t.exposeInt("totalItems"),
    totalEstimatedCost: t.exposeFloat("totalEstimatedCost"),
    highPriorityCount: t.exposeInt("highPriorityCount"),
    mediumPriorityCount: t.exposeInt("mediumPriorityCount"),
    lowPriorityCount: t.exposeInt("lowPriorityCount"),
    gameCount: t.exposeInt("gameCount"),
    dlcCount: t.exposeInt("dlcCount"),
    bundleCount: t.exposeInt("bundleCount"),
  }),
});

// Input type for converting buylist item to collection
export const ConvertBuylistToCollectionInput = builder.inputType(
  "ConvertBuylistToCollectionInput",
  {
    fields: (t) => ({
      buylistItemId: t.id({ required: true }),
      platformId: t.id({ required: false }),
      gameVersionId: t.id({ required: false }),
      region: t.field({ type: GameRegionEnum, required: false }),
      isDigital: t.boolean({ required: false, defaultValue: false }),
      hasDisc: t.boolean({ required: false, defaultValue: true }),
      hasBox: t.boolean({ required: false, defaultValue: true }),
      hasManual: t.boolean({ required: false, defaultValue: true }),
      hasExtras: t.boolean({ required: false, defaultValue: false }),
      isSealed: t.boolean({ required: false, defaultValue: false }),
      notes: t.string({ required: false }),
    }),
  }
);

// Result type for converting buylist item to collection
export const ConvertBuylistToCollectionResult = builder.objectRef<{
  success: boolean;
  collectionItemId: string | null;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("ConvertBuylistToCollectionResult");

ConvertBuylistToCollectionResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    collectionItem: t.prismaField({
      type: "CollectionItem",
      nullable: true,
      resolve: async (query, result, _args, ctx) => {
        if (!result.collectionItemId) return null;
        return ctx.prisma.collectionItem.findUnique({
          ...query,
          where: { id: result.collectionItemId },
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
