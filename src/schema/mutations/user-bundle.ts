import { builder } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";
import {
  addGamesToLibrary,
  resolveBundleLibraryGames,
} from "../../lib/library.js";
import { UserBundleMutationResult } from "../types/bundle.js";

// Add bundle to user's collection. Bundle ownership lives in CollectionItem
// (bundleId set instead of gameId), so bundles carry region/condition and can
// be sold like any other physical item.
builder.mutationField("addBundleToOwned", (t) =>
  t.field({
    type: UserBundleMutationResult,
    args: {
      bundleId: t.arg.id({ required: true }),
      platformId: t.arg.id({ required: false }),
      // GameFamily ids from this bundle whose games should also be added to
      // the user's library (as BACKLOG). Families not in the bundle are ignored.
      libraryGameFamilyIds: t.arg.idList({ required: false }),
    },
    resolve: async (
      _root,
      { bundleId, platformId, libraryGameFamilyIds },
      ctx
    ) => {
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
        select: {
          id: true,
          gameFamilies: { select: { id: true } },
          platforms: { select: { id: true } },
        },
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
      const normalizedPlatformId = platformId ? String(platformId) : null;

      // Check if already owned (with same platform)
      const existing = await ctx.prisma.collectionItem.findFirst({
        where: {
          userId: ctx.user.id,
          bundleId: String(bundleId),
          platformId: normalizedPlatformId,
        },
      });

      let collectionItemId: string;
      if (existing) {
        collectionItemId = existing.id;
      } else {
        const collectionItem = await ctx.prisma.collectionItem.create({
          data: {
            userId: ctx.user.id,
            bundleId: String(bundleId),
            platformId: normalizedPlatformId,
          },
        });
        collectionItemId = collectionItem.id;
      }

      // Add the selected included games to the user's library
      const requestedFamilyIds = (libraryGameFamilyIds ?? []).map(String);
      if (requestedFamilyIds.length > 0) {
        const games = await resolveBundleLibraryGames(
          ctx.prisma,
          bundle,
          normalizedPlatformId,
          requestedFamilyIds
        );
        await addGamesToLibrary(ctx.prisma, ctx.user.id, games);
      }

      return {
        success: true,
        userBundleId: collectionItemId,
        error: null,
      };
    },
  })
);

// Remove bundle from user's collection
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
      const normalizedPlatformId = platformId ? String(platformId) : null;

      // Check if ownership exists
      const existing = await ctx.prisma.collectionItem.findFirst({
        where: {
          userId: ctx.user.id,
          bundleId: String(bundleId),
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

      await ctx.prisma.collectionItem.delete({
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
