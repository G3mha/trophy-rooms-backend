import { builder, BulkDeleteResultRef } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";
import {
  CreateBundleInput,
  UpdateBundleInput,
  BundleMutationResult,
  DeleteBundleResult,
} from "../types/bundle.js";
import { hasRequiredRole } from "../../context.js";
import { UserRole, BundleType } from "@prisma/client";

// Helper to generate slug from name
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Query: Get all bundles with optional type filter
builder.queryField("bundles", (t) =>
  t.prismaField({
    type: ["Bundle"],
    args: {
      type: t.arg({ type: BundleType }),
    },
    resolve: async (query, _root, args, ctx) => {
      return ctx.prisma.bundle.findMany({
        ...query,
        where: args.type ? { type: args.type } : undefined,
        orderBy: [{ type: "asc" }, { name: "asc" }],
      });
    },
  })
);

// Query: Get single bundle by ID
builder.queryField("bundle", (t) =>
  t.prismaField({
    type: "Bundle",
    nullable: true,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      return ctx.prisma.bundle.findUnique({
        ...query,
        where: { id: args.id },
      });
    },
  })
);

// Query: Get user's owned bundles
builder.queryField("myOwnedBundles", (t) =>
  t.prismaField({
    type: ["Bundle"],
    resolve: async (query, _root, _args, ctx) => {
      if (!ctx.user) return [];
      const userBundles = await ctx.prisma.userBundle.findMany({
        where: { userId: ctx.user.id },
        select: { bundleId: true },
      });
      return ctx.prisma.bundle.findMany({
        ...query,
        where: { id: { in: userBundles.map((ub) => ub.bundleId) } },
        orderBy: { name: "asc" },
      });
    },
  })
);

// Create bundle mutation
builder.mutationField("createBundle", (t) =>
  t.field({
    type: BundleMutationResult,
    args: {
      input: t.arg({ type: CreateBundleInput, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          bundleId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to create a bundle",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          bundleId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to create bundles",
            field: null,
          },
        };
      }

      const { name, slug, type, description, coverUrl, releaseDate, price, gameIds, dlcIds } = args.input;

      // Validate name
      const trimmedName = name.trim();
      if (!trimmedName) {
        return {
          success: false,
          bundleId: null,
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
          bundleId: null,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "Slug is required",
            field: "slug",
          },
        };
      }

      // Check for duplicate slug
      const existing = await ctx.prisma.bundle.findUnique({
        where: { slug: trimmedSlug },
      });

      if (existing) {
        return {
          success: false,
          bundleId: null,
          error: {
            code: ErrorCode.ALREADY_EXISTS,
            message: `A bundle with slug "${trimmedSlug}" already exists`,
            field: "slug",
          },
        };
      }

      // Create bundle
      const bundle = await ctx.prisma.bundle.create({
        data: {
          name: trimmedName,
          slug: trimmedSlug,
          type: type ?? BundleType.BUNDLE,
          description: description?.trim() || null,
          coverUrl: coverUrl?.trim() || null,
          releaseDate: releaseDate ?? null,
          price: price ?? null,
          games: gameIds && gameIds.length > 0 ? {
            connect: gameIds.map((id) => ({ id })),
          } : undefined,
          dlcs: dlcIds && dlcIds.length > 0 ? {
            connect: dlcIds.map((id) => ({ id })),
          } : undefined,
        },
      });

      return {
        success: true,
        bundleId: bundle.id,
        error: null,
      };
    },
  })
);

// Update bundle mutation
builder.mutationField("updateBundle", (t) =>
  t.field({
    type: BundleMutationResult,
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: UpdateBundleInput, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          bundleId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to update a bundle",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          bundleId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to update bundles",
            field: null,
          },
        };
      }

      const { id, input } = args;

      // Check if bundle exists
      const existing = await ctx.prisma.bundle.findUnique({
        where: { id },
      });

      if (!existing) {
        return {
          success: false,
          bundleId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Bundle with id "${id}" not found`,
            field: null,
          },
        };
      }

      // Build update data
      const updateData: {
        name?: string;
        slug?: string;
        type?: BundleType;
        description?: string | null;
        coverUrl?: string | null;
        releaseDate?: Date | null;
        price?: number | null;
        games?: { set: { id: string }[] };
        dlcs?: { set: { id: string }[] };
      } = {};

      if (input.name !== undefined && input.name !== null) {
        const trimmedName = input.name.trim();
        if (!trimmedName) {
          return {
            success: false,
            bundleId: null,
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
            bundleId: null,
            error: {
              code: ErrorCode.VALIDATION_ERROR,
              message: "Slug cannot be empty",
              field: "slug",
            },
          };
        }

        // Check for duplicate slug (excluding current bundle)
        if (trimmedSlug !== existing.slug) {
          const duplicate = await ctx.prisma.bundle.findUnique({
            where: { slug: trimmedSlug },
          });

          if (duplicate) {
            return {
              success: false,
              bundleId: null,
              error: {
                code: ErrorCode.ALREADY_EXISTS,
                message: `A bundle with slug "${trimmedSlug}" already exists`,
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

      if (input.gameIds !== undefined) {
        updateData.games = {
          set: (input.gameIds ?? []).map((gid) => ({ id: gid })),
        };
      }

      if (input.dlcIds !== undefined) {
        updateData.dlcs = {
          set: (input.dlcIds ?? []).map((did) => ({ id: did })),
        };
      }

      // Update bundle
      const bundle = await ctx.prisma.bundle.update({
        where: { id },
        data: updateData,
      });

      return {
        success: true,
        bundleId: bundle.id,
        error: null,
      };
    },
  })
);

// Delete bundle mutation
builder.mutationField("deleteBundle", (t) =>
  t.field({
    type: DeleteBundleResult,
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
            message: "You must be logged in to delete a bundle",
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
            message: "You do not have permission to delete bundles",
            field: null,
          },
        };
      }

      const { id } = args;

      // Check if bundle exists
      const existing = await ctx.prisma.bundle.findUnique({
        where: { id },
      });

      if (!existing) {
        return {
          success: false,
          deletedId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Bundle with id "${id}" not found`,
            field: null,
          },
        };
      }

      // Delete bundle (cascades to UserBundle)
      await ctx.prisma.bundle.delete({
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

// Bulk delete bundles mutation
builder.mutationField("bulkDeleteBundles", (t) =>
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
            message: "You must be logged in to delete bundles",
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
            message: "You do not have permission to delete bundles",
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
            message: "At least one bundle ID is required",
            field: "ids",
          },
        };
      }

      const result = await ctx.prisma.bundle.deleteMany({
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

// Add game to bundle
builder.mutationField("addGameToBundle", (t) =>
  t.field({
    type: BundleMutationResult,
    args: {
      gameId: t.arg.id({ required: true }),
      bundleId: t.arg.id({ required: true }),
    },
    resolve: async (_root, { gameId, bundleId }, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          bundleId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to add games to bundles",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          bundleId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to modify bundles",
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
          bundleId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Bundle with id "${bundleId}" not found`,
            field: "bundleId",
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
          bundleId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Game with id "${gameId}" not found`,
            field: "gameId",
          },
        };
      }

      // Connect game to bundle
      await ctx.prisma.bundle.update({
        where: { id: bundleId },
        data: {
          games: {
            connect: { id: gameId },
          },
        },
      });

      return {
        success: true,
        bundleId,
        error: null,
      };
    },
  })
);

// Remove game from bundle
builder.mutationField("removeGameFromBundle", (t) =>
  t.field({
    type: BundleMutationResult,
    args: {
      gameId: t.arg.id({ required: true }),
      bundleId: t.arg.id({ required: true }),
    },
    resolve: async (_root, { gameId, bundleId }, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          bundleId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to remove games from bundles",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          bundleId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to modify bundles",
            field: null,
          },
        };
      }

      // Disconnect game from bundle
      await ctx.prisma.bundle.update({
        where: { id: bundleId },
        data: {
          games: {
            disconnect: { id: gameId },
          },
        },
      });

      return {
        success: true,
        bundleId,
        error: null,
      };
    },
  })
);

// Add DLC to bundle
builder.mutationField("addDLCToBundle", (t) =>
  t.field({
    type: BundleMutationResult,
    args: {
      dlcId: t.arg.id({ required: true }),
      bundleId: t.arg.id({ required: true }),
    },
    resolve: async (_root, { dlcId, bundleId }, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          bundleId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to add DLCs to bundles",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          bundleId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to modify bundles",
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
          bundleId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Bundle with id "${bundleId}" not found`,
            field: "bundleId",
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
          bundleId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `DLC with id "${dlcId}" not found`,
            field: "dlcId",
          },
        };
      }

      // Connect DLC to bundle
      await ctx.prisma.bundle.update({
        where: { id: bundleId },
        data: {
          dlcs: {
            connect: { id: dlcId },
          },
        },
      });

      return {
        success: true,
        bundleId,
        error: null,
      };
    },
  })
);

// Remove DLC from bundle
builder.mutationField("removeDLCFromBundle", (t) =>
  t.field({
    type: BundleMutationResult,
    args: {
      dlcId: t.arg.id({ required: true }),
      bundleId: t.arg.id({ required: true }),
    },
    resolve: async (_root, { dlcId, bundleId }, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          bundleId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to remove DLCs from bundles",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          bundleId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to modify bundles",
            field: null,
          },
        };
      }

      // Disconnect DLC from bundle
      await ctx.prisma.bundle.update({
        where: { id: bundleId },
        data: {
          dlcs: {
            disconnect: { id: dlcId },
          },
        },
      });

      return {
        success: true,
        bundleId,
        error: null,
      };
    },
  })
);
