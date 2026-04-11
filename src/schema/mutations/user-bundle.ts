import { builder } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";
import { UserBundleMutationResult } from "../types/bundle.js";

// Add bundle to user's owned bundles
builder.mutationField("addBundleToOwned", (t) =>
  t.field({
    type: UserBundleMutationResult,
    args: {
      bundleId: t.arg.id({ required: true }),
      platformId: t.arg.id({ required: false }),
    },
    resolve: async (_root, { bundleId, platformId }, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          userBundleId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to add bundles to your collection",
            field: null,
          },
        };
      }

      // Check if bundle exists
      const bundle = await ctx.prisma.bundle.findUnique({
        where: { id: bundleId },
      });

      if (!bundle) {
        return {
          success: false,
          userBundleId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Bundle with id "${bundleId}" not found`,
            field: "bundleId",
          },
        };
      }

      // Normalize platformId: undefined -> null
      const normalizedPlatformId = platformId ?? null;

      // Check if already owned (with same platform)
      const existing = await ctx.prisma.userBundle.findFirst({
        where: {
          userId: ctx.user.id,
          bundleId,
          platformId: normalizedPlatformId,
        },
      });

      if (existing) {
        return {
          success: true,
          userBundleId: existing.id,
          error: null,
        };
      }

      // Create UserBundle
      const userBundle = await ctx.prisma.userBundle.create({
        data: {
          userId: ctx.user.id,
          bundleId,
          platformId: normalizedPlatformId,
        },
      });

      return {
        success: true,
        userBundleId: userBundle.id,
        error: null,
      };
    },
  })
);

// Remove bundle from user's owned bundles
builder.mutationField("removeBundleFromOwned", (t) =>
  t.field({
    type: UserBundleMutationResult,
    args: {
      bundleId: t.arg.id({ required: true }),
      platformId: t.arg.id({ required: false }),
    },
    resolve: async (_root, { bundleId, platformId }, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          userBundleId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to remove bundles from your collection",
            field: null,
          },
        };
      }

      // Normalize platformId: undefined -> null
      const normalizedPlatformId = platformId ?? null;

      // Check if ownership exists
      const existing = await ctx.prisma.userBundle.findFirst({
        where: {
          userId: ctx.user.id,
          bundleId,
          platformId: normalizedPlatformId,
        },
      });

      if (!existing) {
        return {
          success: true,
          userBundleId: null,
          error: null,
        };
      }

      // Delete UserBundle by id
      await ctx.prisma.userBundle.delete({
        where: {
          id: existing.id,
        },
      });

      return {
        success: true,
        userBundleId: existing.id,
        error: null,
      };
    },
  })
);
