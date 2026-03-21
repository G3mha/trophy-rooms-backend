import { builder, BulkDeleteResultRef } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";
import {
  CreateDLCInput,
  UpdateDLCInput,
  DLCMutationResult,
  DeleteDLCResult,
} from "../types/dlc.js";
import { hasRequiredRole } from "../../context.js";
import { UserRole, DLCType } from "@prisma/client";

// Helper to generate slug from name
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Query: Get all DLCs for a game
builder.queryField("dlcs", (t) =>
  t.prismaField({
    type: ["DLC"],
    args: {
      gameId: t.arg.id({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      return ctx.prisma.dLC.findMany({
        ...query,
        where: { gameId: args.gameId },
        orderBy: [{ type: "asc" }, { name: "asc" }],
      });
    },
  })
);

// Query: Get single DLC by ID
builder.queryField("dlc", (t) =>
  t.prismaField({
    type: "DLC",
    nullable: true,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      return ctx.prisma.dLC.findUnique({
        ...query,
        where: { id: args.id },
      });
    },
  })
);

// Query: Get user's owned DLCs
builder.queryField("myOwnedDlcs", (t) =>
  t.prismaField({
    type: ["DLC"],
    resolve: async (query, _root, _args, ctx) => {
      if (!ctx.user) return [];
      const userDlcs = await ctx.prisma.userDLC.findMany({
        where: { userId: ctx.user.id },
        select: { dlcId: true },
      });
      return ctx.prisma.dLC.findMany({
        ...query,
        where: { id: { in: userDlcs.map((ud) => ud.dlcId) } },
        orderBy: { name: "asc" },
      });
    },
  })
);

// Create DLC mutation
builder.mutationField("createDLC", (t) =>
  t.field({
    type: DLCMutationResult,
    args: {
      input: t.arg({ type: CreateDLCInput, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          dlcId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to create a DLC",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          dlcId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to create DLCs",
            field: null,
          },
        };
      }

      const { gameId, name, slug, type, description, coverUrl, releaseDate, price } = args.input;

      // Validate name
      const trimmedName = name.trim();
      if (!trimmedName) {
        return {
          success: false,
          dlcId: null,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "Name is required",
            field: "name",
          },
        };
      }

      // Validate/generate slug
      const trimmedSlug = slug?.trim() ? slugify(slug.trim()) : slugify(trimmedName);
      if (!trimmedSlug) {
        return {
          success: false,
          dlcId: null,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "Slug is required",
            field: "slug",
          },
        };
      }

      // Check if game exists
      const game = await ctx.prisma.game.findUnique({
        where: { id: gameId },
      });

      if (!game) {
        return {
          success: false,
          dlcId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Game with id "${gameId}" not found`,
            field: "gameId",
          },
        };
      }

      // Check for duplicate slug
      const existing = await ctx.prisma.dLC.findUnique({
        where: {
          gameId_slug: {
            gameId,
            slug: trimmedSlug,
          },
        },
      });

      if (existing) {
        return {
          success: false,
          dlcId: null,
          error: {
            code: ErrorCode.ALREADY_EXISTS,
            message: `A DLC with slug "${trimmedSlug}" already exists for this game`,
            field: "slug",
          },
        };
      }

      // Create DLC
      const dlc = await ctx.prisma.dLC.create({
        data: {
          name: trimmedName,
          slug: trimmedSlug,
          type: type ?? DLCType.DLC,
          description: description?.trim() || null,
          coverUrl: coverUrl?.trim() || null,
          releaseDate: releaseDate ?? null,
          price: price ?? null,
          gameId,
        },
      });

      return {
        success: true,
        dlcId: dlc.id,
        error: null,
      };
    },
  })
);

// Update DLC mutation
builder.mutationField("updateDLC", (t) =>
  t.field({
    type: DLCMutationResult,
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: UpdateDLCInput, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          dlcId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to update a DLC",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          dlcId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to update DLCs",
            field: null,
          },
        };
      }

      const { id, input } = args;

      // Check if DLC exists
      const existing = await ctx.prisma.dLC.findUnique({
        where: { id },
      });

      if (!existing) {
        return {
          success: false,
          dlcId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `DLC with id "${id}" not found`,
            field: null,
          },
        };
      }

      // Build update data
      const updateData: {
        name?: string;
        slug?: string;
        type?: DLCType;
        description?: string | null;
        coverUrl?: string | null;
        releaseDate?: Date | null;
        price?: number | null;
      } = {};

      if (input.name !== undefined && input.name !== null) {
        const trimmedName = input.name.trim();
        if (!trimmedName) {
          return {
            success: false,
            dlcId: null,
            error: {
              code: ErrorCode.VALIDATION_ERROR,
              message: "Name cannot be empty",
              field: "name",
            },
          };
        }
        updateData.name = trimmedName;
      }

      if (input.slug !== undefined && input.slug !== null) {
        const trimmedSlug = slugify(input.slug.trim());
        if (!trimmedSlug) {
          return {
            success: false,
            dlcId: null,
            error: {
              code: ErrorCode.VALIDATION_ERROR,
              message: "Slug cannot be empty",
              field: "slug",
            },
          };
        }

        // Check for duplicate slug (excluding current DLC)
        if (trimmedSlug !== existing.slug) {
          const duplicate = await ctx.prisma.dLC.findUnique({
            where: {
              gameId_slug: {
                gameId: existing.gameId,
                slug: trimmedSlug,
              },
            },
          });

          if (duplicate) {
            return {
              success: false,
              dlcId: null,
              error: {
                code: ErrorCode.ALREADY_EXISTS,
                message: `A DLC with slug "${trimmedSlug}" already exists for this game`,
                field: "slug",
              },
            };
          }
        }
        updateData.slug = trimmedSlug;
      }

      if (input.type !== undefined && input.type !== null) {
        updateData.type = input.type;
      }

      if (input.description !== undefined) {
        updateData.description = input.description?.trim() || null;
      }

      if (input.coverUrl !== undefined) {
        updateData.coverUrl = input.coverUrl?.trim() || null;
      }

      if (input.releaseDate !== undefined) {
        updateData.releaseDate = input.releaseDate ?? null;
      }

      if (input.price !== undefined) {
        updateData.price = input.price ?? null;
      }

      // Update DLC
      const dlc = await ctx.prisma.dLC.update({
        where: { id },
        data: updateData,
      });

      return {
        success: true,
        dlcId: dlc.id,
        error: null,
      };
    },
  })
);

// Delete DLC mutation
builder.mutationField("deleteDLC", (t) =>
  t.field({
    type: DeleteDLCResult,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          deletedId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to delete a DLC",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          deletedId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to delete DLCs",
            field: null,
          },
        };
      }

      const { id } = args;

      // Check if DLC exists
      const existing = await ctx.prisma.dLC.findUnique({
        where: { id },
      });

      if (!existing) {
        return {
          success: false,
          deletedId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `DLC with id "${id}" not found`,
            field: null,
          },
        };
      }

      // Delete DLC (cascades to UserDLC, AchievementSet.dlcId will be set to null)
      await ctx.prisma.dLC.delete({
        where: { id },
      });

      return {
        success: true,
        deletedId: id,
        error: null,
      };
    },
  })
);

// Bulk delete DLCs mutation
builder.mutationField("bulkDeleteDLCs", (t) =>
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
            message: "You must be logged in to delete DLCs",
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
            message: "You do not have permission to delete DLCs",
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
            message: "At least one DLC ID is required",
            field: "ids",
          },
        };
      }

      const result = await ctx.prisma.dLC.deleteMany({
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

// Add DLC to game version
builder.mutationField("addDLCToVersion", (t) =>
  t.field({
    type: DLCMutationResult,
    args: {
      dlcId: t.arg.id({ required: true }),
      versionId: t.arg.id({ required: true }),
    },
    resolve: async (_root, { dlcId, versionId }, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          dlcId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to add DLC to a version",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          dlcId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to add DLC to versions",
            field: null,
          },
        };
      }

      // Check if DLC exists
      const dlc = await ctx.prisma.dLC.findUnique({
        where: { id: dlcId },
      });

      if (!dlc) {
        return {
          success: false,
          dlcId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `DLC with id "${dlcId}" not found`,
            field: "dlcId",
          },
        };
      }

      // Check if version exists
      const version = await ctx.prisma.gameVersion.findUnique({
        where: { id: versionId },
      });

      if (!version) {
        return {
          success: false,
          dlcId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Game version with id "${versionId}" not found`,
            field: "versionId",
          },
        };
      }

      // Ensure DLC and version belong to the same game
      if (dlc.gameId !== version.gameId) {
        return {
          success: false,
          dlcId: null,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "DLC and game version must belong to the same game",
            field: null,
          },
        };
      }

      // Connect DLC to version
      await ctx.prisma.gameVersion.update({
        where: { id: versionId },
        data: {
          dlcs: {
            connect: { id: dlcId },
          },
        },
      });

      return {
        success: true,
        dlcId,
        error: null,
      };
    },
  })
);

// Remove DLC from game version
builder.mutationField("removeDLCFromVersion", (t) =>
  t.field({
    type: DLCMutationResult,
    args: {
      dlcId: t.arg.id({ required: true }),
      versionId: t.arg.id({ required: true }),
    },
    resolve: async (_root, { dlcId, versionId }, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          dlcId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to remove DLC from a version",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          dlcId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to remove DLC from versions",
            field: null,
          },
        };
      }

      // Disconnect DLC from version
      await ctx.prisma.gameVersion.update({
        where: { id: versionId },
        data: {
          dlcs: {
            disconnect: { id: dlcId },
          },
        },
      });

      return {
        success: true,
        dlcId,
        error: null,
      };
    },
  })
);
