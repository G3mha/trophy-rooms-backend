import { builder, BulkDeleteResultRef } from "../builder.js";
import {
  CreatePlatformInput,
  UpdatePlatformInput,
  PlatformMutationResult,
} from "../types/platform.js";
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
        data: { name: trimmedName, slug: trimmedSlug },
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
