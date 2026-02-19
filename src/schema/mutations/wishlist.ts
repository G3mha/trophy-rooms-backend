import { builder, MutationErrorRef } from "../builder.js";
import { ErrorCode, MutationError } from "../../lib/errors.js";
import { requireAuth } from "../../context.js";

// Wishlist mutation result type
const WishlistMutationResult = builder.objectRef<{
  success: boolean;
  wishlistId: string | null;
  error: MutationError | null;
}>("WishlistMutationResult");

WishlistMutationResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    wishlistId: t.exposeString("wishlistId", { nullable: true }),
    error: t.field({
      type: MutationErrorRef,
      nullable: true,
      resolve: (result) => result.error,
    }),
  }),
});

// Simple delete result
const WishlistDeleteResult = builder.objectRef<{
  success: boolean;
  error: MutationError | null;
}>("WishlistDeleteResult");

WishlistDeleteResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    error: t.field({
      type: MutationErrorRef,
      nullable: true,
      resolve: (result) => result.error,
    }),
  }),
});

// Add game to wishlist
builder.mutationField("addToWishlist", (t) =>
  t.field({
    type: WishlistMutationResult,
    args: {
      gameId: t.arg.id({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      // Require authentication
      let user;
      try {
        user = requireAuth(ctx);
      } catch {
        return {
          success: false,
          wishlistId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to add games to your wishlist",
            field: null,
          },
        };
      }

      const { gameId } = args;

      // Check if game exists
      const game = await ctx.prisma.game.findUnique({
        where: { id: gameId },
      });

      if (!game) {
        return {
          success: false,
          wishlistId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Game with id "${gameId}" not found`,
            field: "gameId",
          },
        };
      }

      // Check if already in wishlist
      const existing = await ctx.prisma.wishlist.findUnique({
        where: {
          userId_gameId: {
            userId: user.id,
            gameId,
          },
        },
      });

      if (existing) {
        return {
          success: false,
          wishlistId: existing.id,
          error: {
            code: ErrorCode.ALREADY_EXISTS,
            message: "This game is already in your wishlist",
            field: null,
          },
        };
      }

      // Add to wishlist
      const wishlistItem = await ctx.prisma.wishlist.create({
        data: {
          userId: user.id,
          gameId,
        },
      });

      return {
        success: true,
        wishlistId: wishlistItem.id,
        error: null,
      };
    },
  })
);

// Remove game from wishlist
builder.mutationField("removeFromWishlist", (t) =>
  t.field({
    type: WishlistDeleteResult,
    args: {
      gameId: t.arg.id({ required: true }),
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
            message: "You must be logged in to manage your wishlist",
            field: null,
          },
        };
      }

      const { gameId } = args;

      // Check if in wishlist
      const existing = await ctx.prisma.wishlist.findUnique({
        where: {
          userId_gameId: {
            userId: user.id,
            gameId,
          },
        },
      });

      if (!existing) {
        return {
          success: false,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: "This game is not in your wishlist",
            field: null,
          },
        };
      }

      // Remove from wishlist
      await ctx.prisma.wishlist.delete({
        where: { id: existing.id },
      });

      return {
        success: true,
        error: null,
      };
    },
  })
);

// Toggle wishlist (add if not present, remove if present)
builder.mutationField("toggleWishlist", (t) =>
  t.field({
    type: WishlistMutationResult,
    args: {
      gameId: t.arg.id({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      // Require authentication
      let user;
      try {
        user = requireAuth(ctx);
      } catch {
        return {
          success: false,
          wishlistId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to manage your wishlist",
            field: null,
          },
        };
      }

      const { gameId } = args;

      // Check if game exists
      const game = await ctx.prisma.game.findUnique({
        where: { id: gameId },
      });

      if (!game) {
        return {
          success: false,
          wishlistId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Game with id "${gameId}" not found`,
            field: "gameId",
          },
        };
      }

      // Check if in wishlist
      const existing = await ctx.prisma.wishlist.findUnique({
        where: {
          userId_gameId: {
            userId: user.id,
            gameId,
          },
        },
      });

      if (existing) {
        // Remove from wishlist
        await ctx.prisma.wishlist.delete({
          where: { id: existing.id },
        });
        return {
          success: true,
          wishlistId: null, // null indicates it was removed
          error: null,
        };
      } else {
        // Add to wishlist
        const wishlistItem = await ctx.prisma.wishlist.create({
          data: {
            userId: user.id,
            gameId,
          },
        });
        return {
          success: true,
          wishlistId: wishlistItem.id,
          error: null,
        };
      }
    },
  })
);
