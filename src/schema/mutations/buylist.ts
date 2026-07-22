import { GameStatus, BuylistPriority, Prisma, GameRegion } from "@prisma/client";
import { builder } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";
import { requireAuth } from "../../context.js";
import {
  BuylistMutationResult,
  AddToBuylistInput,
  UpdateBuylistItemInput,
  ConvertBuylistToCollectionInput,
  ConvertBuylistToCollectionResult,
} from "../types/buylist.js";
import { GameRegionEnum } from "../types/collection-item.js";

// Add item to buylist
builder.mutationField("addToBuylist", (t) =>
  t.field({
    type: BuylistMutationResult,
    args: {
      input: t.arg({ type: AddToBuylistInput, required: true }),
    },
    resolve: async (_root, { input }, ctx) => {
      let user;
      try {
        user = requireAuth(ctx);
      } catch {
        return {
          success: false,
          buylistItemId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to add items to your buylist",
            field: null,
          },
        };
      }

      const { gameId, gameVersionId, dlcId, bundleId, priority, notes, estimatedPrice } = input;

      // Validate that exactly one item type is provided
      const itemTypes = [gameId, dlcId, bundleId].filter(Boolean);
      if (itemTypes.length === 0) {
        return {
          success: false,
          buylistItemId: null,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "You must provide either a gameId, dlcId, or bundleId",
            field: null,
          },
        };
      }
      if (itemTypes.length > 1) {
        return {
          success: false,
          buylistItemId: null,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "You can only provide one of gameId, dlcId, or bundleId",
            field: null,
          },
        };
      }

      // Validate gameVersionId is only provided with gameId
      if (gameVersionId && !gameId) {
        return {
          success: false,
          buylistItemId: null,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "gameVersionId can only be provided with gameId",
            field: "gameVersionId",
          },
        };
      }

      // Validate the referenced item exists
      if (gameId) {
        const game = await ctx.prisma.game.findUnique({ where: { id: gameId } });
        if (!game) {
          return {
            success: false,
            buylistItemId: null,
            error: {
              code: ErrorCode.NOT_FOUND,
              message: `Game with id "${gameId}" not found`,
              field: "gameId",
            },
          };
        }

        if (gameVersionId) {
          const version = await ctx.prisma.gameVersion.findUnique({
            where: { id: gameVersionId },
            include: { games: { select: { id: true } } },
          });
          if (!version) {
            return {
              success: false,
              buylistItemId: null,
              error: {
                code: ErrorCode.NOT_FOUND,
                message: `Game version with id "${gameVersionId}" not found`,
                field: "gameVersionId",
              },
            };
          }
          const isLinked = version.games.some((g) => g.id === gameId);
          if (!isLinked) {
            return {
              success: false,
              buylistItemId: null,
              error: {
                code: ErrorCode.VALIDATION_ERROR,
                message: "Game version is not linked to the specified game",
                field: "gameVersionId",
              },
            };
          }
        }
      }

      if (dlcId) {
        const dlc = await ctx.prisma.dLC.findUnique({ where: { id: dlcId } });
        if (!dlc) {
          return {
            success: false,
            buylistItemId: null,
            error: {
              code: ErrorCode.NOT_FOUND,
              message: `DLC with id "${dlcId}" not found`,
              field: "dlcId",
            },
          };
        }
      }

      if (bundleId) {
        const bundle = await ctx.prisma.bundle.findUnique({ where: { id: bundleId } });
        if (!bundle) {
          return {
            success: false,
            buylistItemId: null,
            error: {
              code: ErrorCode.NOT_FOUND,
              message: `Bundle with id "${bundleId}" not found`,
              field: "bundleId",
            },
          };
        }
      }

      // Check if item already exists in buylist
      const existing = await ctx.prisma.buylistItem.findFirst({
        where: {
          userId: user.id,
          gameId: gameId ?? null,
          gameVersionId: gameVersionId ?? null,
          dlcId: dlcId ?? null,
          bundleId: bundleId ?? null,
        },
      });

      if (existing) {
        // Return success with existing item (idempotent)
        return {
          success: true,
          buylistItemId: existing.id,
          error: null,
        };
      }

      // Create the buylist item
      const buylistItem = await ctx.prisma.buylistItem.create({
        data: {
          userId: user.id,
          gameId: gameId ?? null,
          gameVersionId: gameVersionId ?? null,
          dlcId: dlcId ?? null,
          bundleId: bundleId ?? null,
          priority: priority ?? BuylistPriority.MEDIUM,
          notes: notes ?? null,
          estimatedPrice: estimatedPrice ?? null,
        },
      });

      return {
        success: true,
        buylistItemId: buylistItem.id,
        error: null,
      };
    },
  })
);

// Remove item from buylist
builder.mutationField("removeFromBuylist", (t) =>
  t.field({
    type: BuylistMutationResult,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: async (_root, { id }, ctx) => {
      let user;
      try {
        user = requireAuth(ctx);
      } catch {
        return {
          success: false,
          buylistItemId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to remove items from your buylist",
            field: null,
          },
        };
      }

      // Find the item
      const item = await ctx.prisma.buylistItem.findUnique({
        where: { id },
      });

      if (!item) {
        return {
          success: true,
          buylistItemId: null,
          error: null,
        };
      }

      // Verify ownership
      if (item.userId !== user.id) {
        return {
          success: false,
          buylistItemId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You can only remove items from your own buylist",
            field: null,
          },
        };
      }

      // Delete the item
      await ctx.prisma.buylistItem.delete({
        where: { id },
      });

      return {
        success: true,
        buylistItemId: id,
        error: null,
      };
    },
  })
);

// Update buylist item
builder.mutationField("updateBuylistItem", (t) =>
  t.field({
    type: BuylistMutationResult,
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: UpdateBuylistItemInput, required: true }),
    },
    resolve: async (_root, { id, input }, ctx) => {
      let user;
      try {
        user = requireAuth(ctx);
      } catch {
        return {
          success: false,
          buylistItemId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to update your buylist",
            field: null,
          },
        };
      }

      // Find the item
      const item = await ctx.prisma.buylistItem.findUnique({
        where: { id },
      });

      if (!item) {
        return {
          success: false,
          buylistItemId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: "Buylist item not found",
            field: "id",
          },
        };
      }

      // Verify ownership
      if (item.userId !== user.id) {
        return {
          success: false,
          buylistItemId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You can only update items in your own buylist",
            field: null,
          },
        };
      }

      const { priority, notes, estimatedPrice, gameVersionId } = input;

      // Validate gameVersionId if provided
      if (gameVersionId !== undefined) {
        if (!item.gameId) {
          return {
            success: false,
            buylistItemId: null,
            error: {
              code: ErrorCode.VALIDATION_ERROR,
              message: "gameVersionId can only be set for game items",
              field: "gameVersionId",
            },
          };
        }

        if (gameVersionId) {
          const version = await ctx.prisma.gameVersion.findUnique({
            where: { id: gameVersionId },
            include: { games: { select: { id: true } } },
          });
          if (!version) {
            return {
              success: false,
              buylistItemId: null,
              error: {
                code: ErrorCode.NOT_FOUND,
                message: `Game version with id "${gameVersionId}" not found`,
                field: "gameVersionId",
              },
            };
          }
          const isLinked = item.gameId && version.games.some((g) => g.id === item.gameId);
          if (!isLinked) {
            return {
              success: false,
              buylistItemId: null,
              error: {
                code: ErrorCode.VALIDATION_ERROR,
                message: "Game version is not linked to the specified game",
                field: "gameVersionId",
              },
            };
          }
        }
      }

      // Build update data using Prisma's types
      const updateData: Prisma.BuylistItemUpdateInput = {};

      if (priority !== undefined && priority !== null) {
        updateData.priority = priority;
      }
      if (notes !== undefined) {
        updateData.notes = notes;
      }
      if (estimatedPrice !== undefined) {
        updateData.estimatedPrice = estimatedPrice;
      }
      if (gameVersionId !== undefined) {
        if (gameVersionId === null) {
          updateData.gameVersion = { disconnect: true };
        } else {
          updateData.gameVersion = { connect: { id: gameVersionId } };
        }
      }

      // Update the item
      const updated = await ctx.prisma.buylistItem.update({
        where: { id },
        data: updateData,
      });

      return {
        success: true,
        buylistItemId: updated.id,
        error: null,
      };
    },
  })
);

// Mark item as purchased - moves to owned collection and removes from buylist
builder.mutationField("markAsPurchased", (t) =>
  t.field({
    type: BuylistMutationResult,
    args: {
      id: t.arg.id({ required: true }),
      platformId: t.arg.id({ required: false }), // Optional platform for games
      purchasePrice: t.arg.float({ required: false }), // Actual purchase price
      purchasedAt: t.arg({ type: "DateTime", required: false }), // When purchased
      // Collection item fields (for games only)
      region: t.arg({ type: GameRegionEnum, required: false }),
      isDigital: t.arg.boolean({ required: false }),
      hasDisc: t.arg.boolean({ required: false }),
      hasBox: t.arg.boolean({ required: false }),
      hasManual: t.arg.boolean({ required: false }),
      hasExtras: t.arg.boolean({ required: false }),
      isSealed: t.arg.boolean({ required: false }),
    },
    resolve: async (_root, { id, platformId, purchasePrice, purchasedAt, region, isDigital, hasDisc, hasBox, hasManual, hasExtras, isSealed }, ctx) => {
      let user;
      try {
        user = requireAuth(ctx);
      } catch {
        return {
          success: false,
          buylistItemId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to mark items as purchased",
            field: null,
          },
        };
      }

      // Find the buylist item
      const item = await ctx.prisma.buylistItem.findUnique({
        where: { id },
      });

      if (!item) {
        return {
          success: false,
          buylistItemId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: "Buylist item not found",
            field: "id",
          },
        };
      }

      // Verify ownership
      if (item.userId !== user.id) {
        return {
          success: false,
          buylistItemId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You can only mark your own buylist items as purchased",
            field: null,
          },
        };
      }

      // Validate platform if provided
      if (platformId) {
        const platform = await ctx.prisma.platform.findUnique({
          where: { id: platformId },
        });
        if (!platform) {
          return {
            success: false,
            buylistItemId: null,
            error: {
              code: ErrorCode.NOT_FOUND,
              message: `Platform with id "${platformId}" not found`,
              field: "platformId",
            },
          };
        }
      }

      // Default purchasedAt to current time if not provided
      const purchasedAtValue = purchasedAt ?? new Date();

      // Add to owned collection based on item type
      if (item.gameId) {
        // Add game to library with BACKLOG status
        await ctx.prisma.userGame.upsert({
          where: {
            userId_gameId: {
              userId: user.id,
              gameId: item.gameId,
            },
          },
          update: {
            // Don't overwrite existing status, just update version/platform if provided
            ...(item.gameVersionId && { gameVersionId: item.gameVersionId }),
            ...(platformId && { platformId }),
            // Update purchase info if provided
            ...(purchasePrice !== undefined && purchasePrice !== null && { purchasePrice }),
            ...(purchasedAt !== undefined && { purchasedAt: purchasedAtValue }),
          },
          create: {
            userId: user.id,
            gameId: item.gameId,
            status: GameStatus.BACKLOG,
            gameVersionId: item.gameVersionId,
            platformId: platformId ?? null,
            purchasePrice: purchasePrice ?? null,
            purchasedAt: purchasedAtValue,
          },
        });

        // Also add to physical collection
        const digital = isDigital ?? false;
        await ctx.prisma.collectionItem.create({
          data: {
            userId: user.id,
            gameId: item.gameId,
            platformId: platformId ?? null,
            gameVersionId: item.gameVersionId ?? null,
            region: region ?? GameRegion.NTSC_U,
            isDigital: digital,
            hasDisc: digital ? false : (hasDisc ?? true),
            hasBox: digital ? false : (hasBox ?? true),
            hasManual: digital ? false : (hasManual ?? true),
            hasExtras: digital ? false : (hasExtras ?? false),
            isSealed: digital ? false : (isSealed ?? false),
            notes: item.notes,
          },
        });
      } else if (item.dlcId) {
        // Add DLC to owned
        await ctx.prisma.userDLC.upsert({
          where: {
            userId_dlcId: {
              userId: user.id,
              dlcId: item.dlcId,
            },
          },
          update: {
            // Update purchase info if provided
            ...(purchasePrice !== undefined && purchasePrice !== null && { purchasePrice }),
            ...(purchasedAt !== undefined && { purchasedAt: purchasedAtValue }),
          },
          create: {
            userId: user.id,
            dlcId: item.dlcId,
            purchasePrice: purchasePrice ?? null,
            purchasedAt: purchasedAtValue,
          },
        });
      } else if (item.bundleId) {
        // Add bundle to the collection (without specific platform from buylist)
        const existingItem = await ctx.prisma.collectionItem.findFirst({
          where: {
            userId: user.id,
            bundleId: item.bundleId,
            platformId: null,
          },
        });
        if (existingItem) {
          await ctx.prisma.collectionItem.update({
            where: { id: existingItem.id },
            data: {
              // Update purchase info if provided
              ...(purchasePrice !== undefined && purchasePrice !== null && { purchasePrice }),
              ...(purchasedAt !== undefined && { purchasedAt: purchasedAtValue }),
            },
          });
        } else {
          await ctx.prisma.collectionItem.create({
            data: {
              userId: user.id,
              bundleId: item.bundleId,
              platformId: null,
              purchasePrice: purchasePrice ?? null,
              purchasedAt: purchasedAtValue,
            },
          });
        }
      }

      // Remove from buylist
      await ctx.prisma.buylistItem.delete({
        where: { id },
      });

      return {
        success: true,
        buylistItemId: id,
        error: null,
      };
    },
  })
);

// Convert buylist item to collection item
builder.mutationField("convertBuylistToCollection", (t) =>
  t.field({
    type: ConvertBuylistToCollectionResult,
    args: {
      input: t.arg({ type: ConvertBuylistToCollectionInput, required: true }),
    },
    resolve: async (_root, { input }, ctx) => {
      let user;
      try {
        user = requireAuth(ctx);
      } catch {
        return {
          success: false,
          collectionItemId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to convert buylist items",
            field: null,
          },
        };
      }

      const {
        buylistItemId,
        platformId,
        gameVersionId,
        region,
        isDigital,
        hasDisc,
        hasBox,
        hasManual,
        hasExtras,
        isSealed,
        notes,
      } = input;

      // Find the buylist item
      const buylistItem = await ctx.prisma.buylistItem.findUnique({
        where: { id: buylistItemId },
      });

      if (!buylistItem) {
        return {
          success: false,
          collectionItemId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: "Buylist item not found",
            field: "buylistItemId",
          },
        };
      }

      // Verify ownership
      if (buylistItem.userId !== user.id) {
        return {
          success: false,
          collectionItemId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You can only convert your own buylist items",
            field: null,
          },
        };
      }

      // Validate it's a GAME type (CollectionItem only supports games)
      if (!buylistItem.gameId) {
        return {
          success: false,
          collectionItemId: null,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "Only game items can be converted to collection items. DLCs and bundles are not supported.",
            field: "buylistItemId",
          },
        };
      }

      // Validate platform exists (if provided)
      if (platformId) {
        const platform = await ctx.prisma.platform.findUnique({
          where: { id: platformId },
        });
        if (!platform) {
          return {
            success: false,
            collectionItemId: null,
            error: {
              code: ErrorCode.NOT_FOUND,
              message: `Platform with id "${platformId}" not found`,
              field: "platformId",
            },
          };
        }
      }

      // Validate game version exists (if provided)
      if (gameVersionId) {
        const version = await ctx.prisma.gameVersion.findUnique({
          where: { id: gameVersionId },
          include: { games: { select: { id: true } } },
        });

        if (!version) {
          return {
            success: false,
            collectionItemId: null,
            error: {
              code: ErrorCode.NOT_FOUND,
              message: `Game version with id "${gameVersionId}" not found`,
              field: "gameVersionId",
            },
          };
        }

        // Ensure version is linked to the game
        const isLinked = version.games.some((g) => g.id === buylistItem.gameId);
        if (!isLinked) {
          return {
            success: false,
            collectionItemId: null,
            error: {
              code: ErrorCode.VALIDATION_ERROR,
              message: "Game version is not linked to this game",
              field: "gameVersionId",
            },
          };
        }
      }

      // Create collection item
      const collectionItem = await ctx.prisma.collectionItem.create({
        data: {
          userId: user.id,
          gameId: buylistItem.gameId,
          platformId: platformId ?? null,
          gameVersionId: gameVersionId ?? buylistItem.gameVersionId ?? null,
          region: region ?? GameRegion.NTSC_U,
          isDigital: isDigital ?? false,
          hasDisc: isDigital ? false : (hasDisc ?? true),
          hasBox: isDigital ? false : (hasBox ?? true),
          hasManual: isDigital ? false : (hasManual ?? true),
          hasExtras: isDigital ? false : (hasExtras ?? false),
          isSealed: isDigital ? false : (isSealed ?? false),
          notes: notes ?? buylistItem.notes ?? null,
        },
      });

      // Delete the buylist item
      await ctx.prisma.buylistItem.delete({
        where: { id: buylistItemId },
      });

      return {
        success: true,
        collectionItemId: collectionItem.id,
        error: null,
      };
    },
  })
);
