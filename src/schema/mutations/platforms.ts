import { builder, BulkDeleteResultRef } from "../builder.js";
import {
  CreatePlatformInput,
  UpdatePlatformInput,
  PlatformMutationResult,
} from "../types/platform.js";
import {
  CreatePlatformReleaseInput,
  UpdatePlatformReleaseInput,
  PlatformReleaseMutationResult,
} from "../types/platform-release.js";
import { ErrorCode } from "../../lib/errors.js";
import { hasRequiredRole } from "../../context.js";
import { UserRole } from "@prisma/client";

builder.mutationField("createPlatform", (t) =>
  t.field({
    type: PlatformMutationResult,
    args: {
      input: t.arg({ type: CreatePlatformInput, required: true }),
    },
    resolve: async (_root, { input }, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          platform: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to create a platform",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          platform: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to create platforms",
            field: null,
          },
        };
      }

      const trimmedName = input.name.trim();
      const trimmedSlug = input.slug.trim();

      if (!trimmedName || !trimmedSlug) {
        return {
          success: false,
          platform: null,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "Name and slug are required",
            field: "name",
          },
        };
      }

      const existing = await ctx.prisma.platform.findFirst({
        where: {
          OR: [{ name: trimmedName }, { slug: trimmedSlug }],
        },
      });

      if (existing) {
        return {
          success: false,
          platform: null,
          error: {
            code: ErrorCode.ALREADY_EXISTS,
            message: "A platform with this name or slug already exists",
            field: existing.name === trimmedName ? "name" : "slug",
          },
        };
      }

      const platform = await ctx.prisma.platform.create({
        data: {
          name: trimmedName,
          slug: trimmedSlug,
          description: input.description?.trim() || null,
          consolePictureUrl: input.consolePictureUrl?.trim() || null,
          promotionalPictures: input.promotionalPictures ?? [],
        },
      });

      return {
        success: true,
        platform: { id: platform.id },
        error: null,
      };
    },
  })
);

builder.mutationField("updatePlatform", (t) =>
  t.field({
    type: PlatformMutationResult,
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: UpdatePlatformInput, required: true }),
    },
    resolve: async (_root, { id, input }, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          platform: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to update a platform",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          platform: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to update platforms",
            field: null,
          },
        };
      }

      const existing = await ctx.prisma.platform.findUnique({ where: { id } });

      if (!existing) {
        return {
          success: false,
          platform: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Platform with id "${id}" not found`,
            field: null,
          },
        };
      }

      const trimmedName = input.name?.trim();
      const trimmedSlug = input.slug?.trim();

      if (trimmedName || trimmedSlug) {
        const duplicate = await ctx.prisma.platform.findFirst({
          where: {
            OR: [
              ...(trimmedName ? [{ name: trimmedName }] : []),
              ...(trimmedSlug ? [{ slug: trimmedSlug }] : []),
            ],
            NOT: { id },
          },
        });

        if (duplicate) {
          return {
            success: false,
            platform: null,
            error: {
              code: ErrorCode.ALREADY_EXISTS,
              message: "A platform with this name or slug already exists",
              field: duplicate.name === trimmedName ? "name" : "slug",
            },
          };
        }
      }

      const platform = await ctx.prisma.platform.update({
        where: { id },
        data: {
          name: trimmedName || undefined,
          slug: trimmedSlug || undefined,
          description:
            input.description !== undefined
              ? input.description?.trim() || null
              : undefined,
          consolePictureUrl:
            input.consolePictureUrl !== undefined
              ? input.consolePictureUrl?.trim() || null
              : undefined,
          promotionalPictures:
            input.promotionalPictures !== undefined &&
            input.promotionalPictures !== null
              ? input.promotionalPictures
              : undefined,
        },
      });

      return {
        success: true,
        platform: { id: platform.id },
        error: null,
      };
    },
  })
);

builder.mutationField("deletePlatform", (t) =>
  t.field({
    type: PlatformMutationResult,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: async (_root, { id }, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          platform: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to delete a platform",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          platform: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to delete platforms",
            field: null,
          },
        };
      }

      const existing = await ctx.prisma.platform.findUnique({ where: { id } });

      if (!existing) {
        return {
          success: false,
          platform: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Platform with id "${id}" not found`,
            field: null,
          },
        };
      }

      await ctx.prisma.platform.delete({ where: { id } });

      return {
        success: true,
        platform: { id },
        error: null,
      };
    },
  })
);

builder.mutationField("bulkDeletePlatforms", (t) =>
  t.field({
    type: BulkDeleteResultRef,
    args: {
      ids: t.arg.idList({ required: true }),
    },
    resolve: async (_root, { ids }, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          deletedCount: 0,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to delete platforms",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          deletedCount: 0,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to delete platforms",
            field: null,
          },
        };
      }

      if (ids.length === 0) {
        return {
          success: false,
          deletedCount: 0,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "At least one platform ID is required",
            field: "ids",
          },
        };
      }

      const result = await ctx.prisma.platform.deleteMany({
        where: { id: { in: ids } },
      });

      return {
        success: true,
        deletedCount: result.count,
        error: null,
      };
    },
  })
);

// Platform Release Mutations

builder.mutationField("createPlatformRelease", (t) =>
  t.field({
    type: PlatformReleaseMutationResult,
    args: {
      input: t.arg({ type: CreatePlatformReleaseInput, required: true }),
    },
    resolve: async (_root, { input }, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          release: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to create a platform release",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          release: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to create platform releases",
            field: null,
          },
        };
      }

      const trimmedRegion = input.region.trim().toUpperCase();

      if (!trimmedRegion) {
        return {
          success: false,
          release: null,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "Region is required",
            field: "region",
          },
        };
      }

      // Verify platform exists
      const platform = await ctx.prisma.platform.findUnique({
        where: { id: input.platformId },
      });

      if (!platform) {
        return {
          success: false,
          release: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Platform with id "${input.platformId}" not found`,
            field: "platformId",
          },
        };
      }

      // Check if release for this region already exists
      const existingRelease = await ctx.prisma.platformRelease.findUnique({
        where: {
          platformId_region: {
            platformId: input.platformId,
            region: trimmedRegion,
          },
        },
      });

      if (existingRelease) {
        return {
          success: false,
          release: null,
          error: {
            code: ErrorCode.ALREADY_EXISTS,
            message: `A release for region "${trimmedRegion}" already exists for this platform`,
            field: "region",
          },
        };
      }

      const release = await ctx.prisma.platformRelease.create({
        data: {
          platformId: input.platformId,
          region: trimmedRegion,
          releaseDate: input.releaseDate,
        },
      });

      return {
        success: true,
        release: { id: release.id },
        error: null,
      };
    },
  })
);

builder.mutationField("updatePlatformRelease", (t) =>
  t.field({
    type: PlatformReleaseMutationResult,
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: UpdatePlatformReleaseInput, required: true }),
    },
    resolve: async (_root, { id, input }, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          release: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to update a platform release",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          release: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to update platform releases",
            field: null,
          },
        };
      }

      const existing = await ctx.prisma.platformRelease.findUnique({
        where: { id },
      });

      if (!existing) {
        return {
          success: false,
          release: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Platform release with id "${id}" not found`,
            field: null,
          },
        };
      }

      const trimmedRegion = input.region?.trim().toUpperCase();

      // Check for duplicate region if changing
      if (trimmedRegion && trimmedRegion !== existing.region) {
        const duplicate = await ctx.prisma.platformRelease.findUnique({
          where: {
            platformId_region: {
              platformId: existing.platformId,
              region: trimmedRegion,
            },
          },
        });

        if (duplicate) {
          return {
            success: false,
            release: null,
            error: {
              code: ErrorCode.ALREADY_EXISTS,
              message: `A release for region "${trimmedRegion}" already exists for this platform`,
              field: "region",
            },
          };
        }
      }

      const release = await ctx.prisma.platformRelease.update({
        where: { id },
        data: {
          region: trimmedRegion || undefined,
          releaseDate: input.releaseDate || undefined,
        },
      });

      return {
        success: true,
        release: { id: release.id },
        error: null,
      };
    },
  })
);

builder.mutationField("deletePlatformRelease", (t) =>
  t.field({
    type: PlatformReleaseMutationResult,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: async (_root, { id }, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          release: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to delete a platform release",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          release: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to delete platform releases",
            field: null,
          },
        };
      }

      const existing = await ctx.prisma.platformRelease.findUnique({
        where: { id },
      });

      if (!existing) {
        return {
          success: false,
          release: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Platform release with id "${id}" not found`,
            field: null,
          },
        };
      }

      await ctx.prisma.platformRelease.delete({ where: { id } });

      return {
        success: true,
        release: { id },
        error: null,
      };
    },
  })
);
