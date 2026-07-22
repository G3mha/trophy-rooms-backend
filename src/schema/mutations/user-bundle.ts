import { builder } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";
import { addGamesToLibrary } from "../../lib/library.js";
import { UserBundleMutationResult } from "../types/bundle.js";

// Add bundle to user's owned bundles
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
      const normalizedPlatformId = platformId ?? null;

      // Check if already owned (with same platform)
      const existing = await ctx.prisma.userBundle.findFirst({
        where: {
          userId: ctx.user.id,
          bundleId,
          platformId: normalizedPlatformId,
        },
      });

      let userBundleId: string;
      if (existing) {
        userBundleId = existing.id;
      } else {
        const userBundle = await ctx.prisma.userBundle.create({
          data: {
            userId: ctx.user.id,
            bundleId,
            platformId: normalizedPlatformId,
          },
        });
        userBundleId = userBundle.id;
      }

      // Add the selected included games to the user's library
      const requestedFamilyIds = (libraryGameFamilyIds ?? []).map(String);
      if (requestedFamilyIds.length > 0) {
        const bundleFamilyIds = new Set(bundle.gameFamilies.map((f) => f.id));
        const familyIds = requestedFamilyIds.filter((id) =>
          bundleFamilyIds.has(id)
        );

        if (familyIds.length > 0) {
          const bundlePlatformIds = bundle.platforms.map((p) => p.id);
          const games = await ctx.prisma.game.findMany({
            where: {
              gameFamilyId: { in: familyIds },
              ...(normalizedPlatformId
                ? { platformId: normalizedPlatformId }
                : bundlePlatformIds.length > 0
                  ? { platformId: { in: bundlePlatformIds } }
                  : {}),
            },
            select: { id: true, gameFamilyId: true, platformId: true },
          });

          // One game per family: without an explicit platform, a family could
          // match on several of the bundle's platforms
          const seenFamilies = new Set<string>();
          const gamesPerFamily = games.filter((game) => {
            if (!game.gameFamilyId || seenFamilies.has(game.gameFamilyId)) {
              return false;
            }
            seenFamilies.add(game.gameFamilyId);
            return true;
          });

          await addGamesToLibrary(ctx.prisma, ctx.user.id, gamesPerFamily);
        }
      }

      return {
        success: true,
        userBundleId,
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
