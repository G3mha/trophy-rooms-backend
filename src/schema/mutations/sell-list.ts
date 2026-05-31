import { ItemCondition, SellListItemStatus, Prisma } from "@prisma/client";
import { builder } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";
import { requireAuth } from "../../context.js";
import {
  SellListMutationResult,
  AddToSellListInput,
  UpdateSellListItemInput,
  MarkAsSoldInput,
} from "../types/sell-list.js";

// Add item to sell list
builder.mutationField("addToSellList", (t) =>
  t.field({
    type: SellListMutationResult,
    args: {
      input: t.arg({ type: AddToSellListInput, required: true }),
    },
    resolve: async (_root, { input }, ctx) => {
      let user;
      try {
        user = requireAuth(ctx);
      } catch {
        return {
          success: false,
          sellListItemId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to add items to your sell list",
            field: null,
          },
        };
      }

      const { collectionItemId, askingPrice, condition, conditionNotes, listingUrl, notes } = input;

      // Validate the collection item exists and belongs to the user
      const collectionItem = await ctx.prisma.collectionItem.findUnique({
        where: { id: collectionItemId },
      });

      if (!collectionItem) {
        return {
          success: false,
          sellListItemId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Collection item with id "${collectionItemId}" not found`,
            field: "collectionItemId",
          },
        };
      }

      if (collectionItem.userId !== user.id) {
        return {
          success: false,
          sellListItemId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You can only add items from your own collection to the sell list",
            field: "collectionItemId",
          },
        };
      }

      // Check if item already exists in sell list (active)
      const existing = await ctx.prisma.sellListItem.findFirst({
        where: {
          userId: user.id,
          collectionItemId,
          status: SellListItemStatus.ACTIVE,
        },
      });

      if (existing) {
        // Return success with existing item (idempotent)
        return {
          success: true,
          sellListItemId: existing.id,
          error: null,
        };
      }

      // Create the sell list item
      const sellListItem = await ctx.prisma.sellListItem.create({
        data: {
          userId: user.id,
          collectionItemId,
          askingPrice: askingPrice ?? null,
          condition: condition ?? ItemCondition.GOOD,
          conditionNotes: conditionNotes ?? null,
          listingUrl: listingUrl ?? null,
          notes: notes ?? null,
          status: SellListItemStatus.ACTIVE,
        },
      });

      return {
        success: true,
        sellListItemId: sellListItem.id,
        error: null,
      };
    },
  })
);

// Update sell list item
builder.mutationField("updateSellListItem", (t) =>
  t.field({
    type: SellListMutationResult,
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: UpdateSellListItemInput, required: true }),
    },
    resolve: async (_root, { id, input }, ctx) => {
      let user;
      try {
        user = requireAuth(ctx);
      } catch {
        return {
          success: false,
          sellListItemId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to update your sell list",
            field: null,
          },
        };
      }

      // Find the item
      const item = await ctx.prisma.sellListItem.findUnique({
        where: { id },
      });

      if (!item) {
        return {
          success: false,
          sellListItemId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: "Sell list item not found",
            field: "id",
          },
        };
      }

      // Verify ownership
      if (item.userId !== user.id) {
        return {
          success: false,
          sellListItemId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You can only update items in your own sell list",
            field: null,
          },
        };
      }

      // Can only update active items
      if (item.status !== SellListItemStatus.ACTIVE) {
        return {
          success: false,
          sellListItemId: null,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "You can only update active sell list items",
            field: null,
          },
        };
      }

      const { askingPrice, condition, conditionNotes, listingUrl, notes } = input;

      // Build update data
      const updateData: Prisma.SellListItemUpdateInput = {};

      if (askingPrice !== undefined) {
        updateData.askingPrice = askingPrice;
      }
      if (condition !== undefined && condition !== null) {
        updateData.condition = condition;
      }
      if (conditionNotes !== undefined) {
        updateData.conditionNotes = conditionNotes;
      }
      if (listingUrl !== undefined) {
        updateData.listingUrl = listingUrl;
      }
      if (notes !== undefined) {
        updateData.notes = notes;
      }

      // Update the item
      const updated = await ctx.prisma.sellListItem.update({
        where: { id },
        data: updateData,
      });

      return {
        success: true,
        sellListItemId: updated.id,
        error: null,
      };
    },
  })
);

// Remove from sell list (without selling)
builder.mutationField("removeFromSellList", (t) =>
  t.field({
    type: SellListMutationResult,
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
          sellListItemId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to remove items from your sell list",
            field: null,
          },
        };
      }

      // Find the item
      const item = await ctx.prisma.sellListItem.findUnique({
        where: { id },
      });

      if (!item) {
        return {
          success: true,
          sellListItemId: null,
          error: null,
        };
      }

      // Verify ownership
      if (item.userId !== user.id) {
        return {
          success: false,
          sellListItemId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You can only remove items from your own sell list",
            field: null,
          },
        };
      }

      // Mark as removed (keep history)
      await ctx.prisma.sellListItem.update({
        where: { id },
        data: { status: SellListItemStatus.REMOVED },
      });

      return {
        success: true,
        sellListItemId: id,
        error: null,
      };
    },
  })
);

// Mark as sold
builder.mutationField("markAsSold", (t) =>
  t.field({
    type: SellListMutationResult,
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: MarkAsSoldInput, required: true }),
    },
    resolve: async (_root, { id, input }, ctx) => {
      let user;
      try {
        user = requireAuth(ctx);
      } catch {
        return {
          success: false,
          sellListItemId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to mark items as sold",
            field: null,
          },
        };
      }

      // Find the item
      const item = await ctx.prisma.sellListItem.findUnique({
        where: { id },
      });

      if (!item) {
        return {
          success: false,
          sellListItemId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: "Sell list item not found",
            field: "id",
          },
        };
      }

      // Verify ownership
      if (item.userId !== user.id) {
        return {
          success: false,
          sellListItemId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You can only mark your own sell list items as sold",
            field: null,
          },
        };
      }

      // Can only mark active items as sold
      if (item.status !== SellListItemStatus.ACTIVE) {
        return {
          success: false,
          sellListItemId: null,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "You can only mark active items as sold",
            field: null,
          },
        };
      }

      const { salePrice, soldAt } = input;

      // Mark as sold
      await ctx.prisma.sellListItem.update({
        where: { id },
        data: {
          status: SellListItemStatus.SOLD,
          salePrice,
          soldAt: soldAt ?? new Date(),
        },
      });

      return {
        success: true,
        sellListItemId: id,
        error: null,
      };
    },
  })
);

// Mark as sold AND remove from collection
builder.mutationField("markAsSoldAndRemoveFromCollection", (t) =>
  t.field({
    type: SellListMutationResult,
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: MarkAsSoldInput, required: true }),
    },
    resolve: async (_root, { id, input }, ctx) => {
      let user;
      try {
        user = requireAuth(ctx);
      } catch {
        return {
          success: false,
          sellListItemId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to mark items as sold",
            field: null,
          },
        };
      }

      // Find the item
      const item = await ctx.prisma.sellListItem.findUnique({
        where: { id },
      });

      if (!item) {
        return {
          success: false,
          sellListItemId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: "Sell list item not found",
            field: "id",
          },
        };
      }

      // Verify ownership
      if (item.userId !== user.id) {
        return {
          success: false,
          sellListItemId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You can only mark your own sell list items as sold",
            field: null,
          },
        };
      }

      // Can only mark active items as sold
      if (item.status !== SellListItemStatus.ACTIVE) {
        return {
          success: false,
          sellListItemId: null,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "You can only mark active items as sold",
            field: null,
          },
        };
      }

      const { salePrice, soldAt } = input;

      // Use a transaction to update sell list item and delete collection item
      await ctx.prisma.$transaction([
        // Mark as sold
        ctx.prisma.sellListItem.update({
          where: { id },
          data: {
            status: SellListItemStatus.SOLD,
            salePrice,
            soldAt: soldAt ?? new Date(),
          },
        }),
        // Delete the collection item
        ctx.prisma.collectionItem.delete({
          where: { id: item.collectionItemId },
        }),
      ]);

      return {
        success: true,
        sellListItemId: id,
        error: null,
      };
    },
  })
);
