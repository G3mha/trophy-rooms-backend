import { GameRegion } from "@prisma/client";
import { builder, MutationErrorRef } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";
import { requireAuth } from "../../context.js";
import { GameRegionEnum } from "../types/collection-item.js";

// CollectionItem mutation result type
const CollectionItemMutationResult = builder.objectRef<{
  success: boolean;
  collectionItem: {
    id: string;
    gameId: string;
    platformId: string | null;
    hasDisc: boolean;
    hasBox: boolean;
    hasManual: boolean;
    hasExtras: boolean;
    isSealed: boolean;
    region: GameRegion;
    notes: string | null;
  } | null;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("CollectionItemMutationResult");

CollectionItemMutationResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    collectionItem: t.prismaField({
      type: "CollectionItem",
      nullable: true,
      resolve: async (query, result, _args, ctx) => {
        if (!result.collectionItem) return null;
        return ctx.prisma.collectionItem.findUnique({
          ...query,
          where: { id: result.collectionItem.id },
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

// Remove from collection result type
const RemoveFromCollectionResult = builder.objectRef<{
  success: boolean;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("RemoveFromCollectionResult");

RemoveFromCollectionResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    error: t.field({
      type: MutationErrorRef,
      nullable: true,
      resolve: (result) => result.error,
    }),
  }),
});

// Input type for adding to collection
const AddToCollectionInput = builder.inputType("AddToCollectionInput", {
  fields: (t) => ({
    gameId: t.id({ required: true }),
    platformId: t.id({ required: false }),
    gameVersionId: t.id({ required: false }),
    hasDisc: t.boolean({ required: false, defaultValue: false }),
    hasBox: t.boolean({ required: false, defaultValue: false }),
    hasManual: t.boolean({ required: false, defaultValue: false }),
    hasExtras: t.boolean({ required: false, defaultValue: false }),
    isDigital: t.boolean({ required: false, defaultValue: false }),
    isSealed: t.boolean({ required: false, defaultValue: false }),
    region: t.field({ type: GameRegionEnum, required: false }),
    notes: t.string({ required: false }),
  }),
});

// Input type for updating collection item
const UpdateCollectionItemInput = builder.inputType("UpdateCollectionItemInput", {
  fields: (t) => ({
    platformId: t.id({ required: false }),
    gameVersionId: t.id({ required: false }),
    hasDisc: t.boolean({ required: false }),
    hasBox: t.boolean({ required: false }),
    hasManual: t.boolean({ required: false }),
    hasExtras: t.boolean({ required: false }),
    isDigital: t.boolean({ required: false }),
    isSealed: t.boolean({ required: false }),
    region: t.field({ type: GameRegionEnum, required: false }),
    notes: t.string({ required: false }),
  }),
});

// Add to collection mutation
builder.mutationField("addToCollection", (t) =>
  t.field({
    type: CollectionItemMutationResult,
    args: {
      input: t.arg({ type: AddToCollectionInput, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      // Require authentication
      let user;
      try {
        user = requireAuth(ctx);
      } catch {
        return {
          success: false,
          collectionItem: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to add to your collection",
            field: null,
          },
        };
      }

      const { gameId, platformId, gameVersionId, hasDisc, hasBox, hasManual, hasExtras, isDigital, isSealed, region, notes } = args.input;

      // Check if game exists
      const game = await ctx.prisma.game.findUnique({
        where: { id: gameId },
      });

      if (!game) {
        return {
          success: false,
          collectionItem: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Game with id "${gameId}" not found`,
            field: "gameId",
          },
        };
      }

      // Check if platform exists (if provided)
      if (platformId) {
        const platform = await ctx.prisma.platform.findUnique({
          where: { id: platformId },
        });

        if (!platform) {
          return {
            success: false,
            collectionItem: null,
            error: {
              code: ErrorCode.NOT_FOUND,
              message: `Platform with id "${platformId}" not found`,
              field: "platformId",
            },
          };
        }
      }

      // Check if game version exists (if provided)
      if (gameVersionId) {
        const version = await ctx.prisma.gameVersion.findUnique({
          where: { id: gameVersionId },
          include: { games: { select: { id: true } } },
        });

        if (!version) {
          return {
            success: false,
            collectionItem: null,
            error: {
              code: ErrorCode.NOT_FOUND,
              message: `Game version with id "${gameVersionId}" not found`,
              field: "gameVersionId",
            },
          };
        }

        // Ensure version is linked to the specified game
        const isLinked = version.games.some((g) => g.id === gameId);
        if (!isLinked) {
          return {
            success: false,
            collectionItem: null,
            error: {
              code: ErrorCode.VALIDATION_ERROR,
              message: "Game version is not linked to the specified game",
              field: "gameVersionId",
            },
          };
        }
      }

      // Create the collection item
      const collectionItem = await ctx.prisma.collectionItem.create({
        data: {
          userId: user.id,
          gameId,
          platformId: platformId ?? null,
          gameVersionId: gameVersionId ?? null,
          hasDisc: hasDisc ?? false,
          hasBox: hasBox ?? false,
          hasManual: hasManual ?? false,
          hasExtras: hasExtras ?? false,
          isDigital: isDigital ?? false,
          isSealed: isSealed ?? false,
          region: region ?? GameRegion.NTSC_U,
          notes: notes ?? null,
        },
      });

      return {
        success: true,
        collectionItem,
        error: null,
      };
    },
  })
);

// Update collection item mutation
builder.mutationField("updateCollectionItem", (t) =>
  t.field({
    type: CollectionItemMutationResult,
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: UpdateCollectionItemInput, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      // Require authentication
      let user;
      try {
        user = requireAuth(ctx);
      } catch {
        return {
          success: false,
          collectionItem: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to update your collection",
            field: null,
          },
        };
      }

      const { id, input } = args;

      // Check if collection item exists and belongs to user
      const existing = await ctx.prisma.collectionItem.findUnique({
        where: { id },
      });

      if (!existing) {
        return {
          success: false,
          collectionItem: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: "Collection item not found",
            field: null,
          },
        };
      }

      if (existing.userId !== user.id) {
        return {
          success: false,
          collectionItem: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You can only update your own collection items",
            field: null,
          },
        };
      }

      // Check if platform exists (if provided)
      if (input.platformId) {
        const platform = await ctx.prisma.platform.findUnique({
          where: { id: input.platformId },
        });

        if (!platform) {
          return {
            success: false,
            collectionItem: null,
            error: {
              code: ErrorCode.NOT_FOUND,
              message: `Platform with id "${input.platformId}" not found`,
              field: "platformId",
            },
          };
        }
      }

      // Check if game version exists (if provided)
      if (input.gameVersionId) {
        const version = await ctx.prisma.gameVersion.findUnique({
          where: { id: input.gameVersionId },
          include: { games: { select: { id: true } } },
        });

        if (!version) {
          return {
            success: false,
            collectionItem: null,
            error: {
              code: ErrorCode.NOT_FOUND,
              message: `Game version with id "${input.gameVersionId}" not found`,
              field: "gameVersionId",
            },
          };
        }

        // Ensure version is linked to the specified game
        const isLinked = version.games.some((g) => g.id === existing.gameId);
        if (!isLinked) {
          return {
            success: false,
            collectionItem: null,
            error: {
              code: ErrorCode.VALIDATION_ERROR,
              message: "Game version is not linked to this game",
              field: "gameVersionId",
            },
          };
        }
      }

      // Build update data
      const updateData: {
        platformId?: string | null;
        gameVersionId?: string | null;
        hasDisc?: boolean;
        hasBox?: boolean;
        hasManual?: boolean;
        hasExtras?: boolean;
        isDigital?: boolean;
        isSealed?: boolean;
        region?: GameRegion;
        notes?: string | null;
      } = {};

      if (input.platformId !== undefined) {
        updateData.platformId = input.platformId;
      }
      if (input.gameVersionId !== undefined) {
        updateData.gameVersionId = input.gameVersionId;
      }
      if (input.hasDisc !== undefined && input.hasDisc !== null) {
        updateData.hasDisc = input.hasDisc;
      }
      if (input.hasBox !== undefined && input.hasBox !== null) {
        updateData.hasBox = input.hasBox;
      }
      if (input.hasManual !== undefined && input.hasManual !== null) {
        updateData.hasManual = input.hasManual;
      }
      if (input.hasExtras !== undefined && input.hasExtras !== null) {
        updateData.hasExtras = input.hasExtras;
      }
      if (input.isDigital !== undefined && input.isDigital !== null) {
        updateData.isDigital = input.isDigital;
      }
      if (input.isSealed !== undefined && input.isSealed !== null) {
        updateData.isSealed = input.isSealed;
      }
      if (input.region !== undefined && input.region !== null) {
        updateData.region = input.region;
      }
      if (input.notes !== undefined) {
        updateData.notes = input.notes;
      }

      // Update the collection item
      const collectionItem = await ctx.prisma.collectionItem.update({
        where: { id },
        data: updateData,
      });

      return {
        success: true,
        collectionItem,
        error: null,
      };
    },
  })
);

// Remove from collection mutation
builder.mutationField("removeFromCollection", (t) =>
  t.field({
    type: RemoveFromCollectionResult,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      // Require authentication
      let user;
      try {
        user = requireAuth(ctx);
      } catch {
        return {
          success: false,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to manage your collection",
            field: null,
          },
        };
      }

      const { id } = args;

      // Check if collection item exists and belongs to user
      const existing = await ctx.prisma.collectionItem.findUnique({
        where: { id },
      });

      if (!existing) {
        return {
          success: false,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: "Collection item not found",
            field: null,
          },
        };
      }

      if (existing.userId !== user.id) {
        return {
          success: false,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You can only remove your own collection items",
            field: null,
          },
        };
      }

      // Delete the collection item
      await ctx.prisma.collectionItem.delete({
        where: { id },
      });

      return {
        success: true,
        error: null,
      };
    },
  })
);
