import { builder, BulkDeleteResultRef } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";
import {
  CreateGameVersionInput,
  UpdateGameVersionInput,
  GameVersionMutationResult,
  DeleteGameVersionResult,
} from "../types/game-version.js";
import { hasRequiredRole } from "../../context.js";
import { UserRole } from "@prisma/client";

// Helper to generate slug from name
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Query: Get all versions (optionally filtered by game)
builder.queryField("gameVersions", (t) =>
  t.prismaField({
    type: ["GameVersion"],
    args: {
      gameId: t.arg.id(), // Now optional - filter by game
    },
    resolve: async (query, _root, args, ctx) => {
      return ctx.prisma.gameVersion.findMany({
        ...query,
        where: args.gameId
          ? { games: { some: { id: args.gameId } } }
          : undefined,
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      });
    },
  })
);

// Query: Get single version by ID
builder.queryField("gameVersion", (t) =>
  t.prismaField({
    type: "GameVersion",
    nullable: true,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      return ctx.prisma.gameVersion.findUnique({
        ...query,
        where: { id: args.id },
      });
    },
  })
);

// Create game version mutation
builder.mutationField("createGameVersion", (t) =>
  t.field({
    type: GameVersionMutationResult,
    args: {
      input: t.arg({ type: CreateGameVersionInput, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          gameVersionId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to create a game version",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          gameVersionId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to create game versions",
            field: null,
          },
        };
      }

      const { gameIds, name, slug, description, coverUrl, releaseDate, dlcIds, isDefault } = args.input;

      // Validate gameIds
      if (!gameIds || gameIds.length === 0) {
        return {
          success: false,
          gameVersionId: null,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "At least one game must be specified",
            field: "gameIds",
          },
        };
      }

      // Validate name
      const trimmedName = name.trim();
      if (!trimmedName) {
        return {
          success: false,
          gameVersionId: null,
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
          gameVersionId: null,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "Slug is required",
            field: "slug",
          },
        };
      }

      // Check if all games exist
      const games = await ctx.prisma.game.findMany({
        where: { id: { in: gameIds } },
        select: { id: true },
      });

      if (games.length !== gameIds.length) {
        const foundIds = new Set(games.map(g => g.id));
        const missingIds = gameIds.filter(id => !foundIds.has(id));
        return {
          success: false,
          gameVersionId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Game(s) not found: ${missingIds.join(", ")}`,
            field: "gameIds",
          },
        };
      }

      // Check for duplicate slug (now globally unique)
      const existing = await ctx.prisma.gameVersion.findUnique({
        where: { slug: trimmedSlug },
      });

      if (existing) {
        return {
          success: false,
          gameVersionId: null,
          error: {
            code: ErrorCode.ALREADY_EXISTS,
            message: `A version with slug "${trimmedSlug}" already exists`,
            field: "slug",
          },
        };
      }

      // If setting as default, unset other defaults globally
      if (isDefault) {
        await ctx.prisma.gameVersion.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }

      // Create version with many-to-many connection to games
      const version = await ctx.prisma.gameVersion.create({
        data: {
          name: trimmedName,
          slug: trimmedSlug,
          description: description?.trim() || null,
          coverUrl: coverUrl?.trim() || null,
          releaseDate: releaseDate ?? null,
          isDefault: isDefault ?? false,
          games: {
            connect: gameIds.map((id) => ({ id })),
          },
          dlcs: dlcIds && dlcIds.length > 0 ? {
            connect: dlcIds.map((id) => ({ id })),
          } : undefined,
        },
      });

      return {
        success: true,
        gameVersionId: version.id,
        error: null,
      };
    },
  })
);

// Update game version mutation
builder.mutationField("updateGameVersion", (t) =>
  t.field({
    type: GameVersionMutationResult,
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: UpdateGameVersionInput, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          gameVersionId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to update a game version",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          gameVersionId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to update game versions",
            field: null,
          },
        };
      }

      const { id, input } = args;

      // Check if version exists
      const existing = await ctx.prisma.gameVersion.findUnique({
        where: { id },
      });

      if (!existing) {
        return {
          success: false,
          gameVersionId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Game version with id "${id}" not found`,
            field: null,
          },
        };
      }

      // Build update data
      const updateData: {
        name?: string;
        slug?: string;
        description?: string | null;
        coverUrl?: string | null;
        releaseDate?: Date | null;
        dlcs?: { set: { id: string }[] };
        games?: { set: { id: string }[] };
      } = {};

      if (input.name !== undefined && input.name !== null) {
        const trimmedName = input.name.trim();
        if (!trimmedName) {
          return {
            success: false,
            gameVersionId: null,
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
            gameVersionId: null,
            error: {
              code: ErrorCode.VALIDATION_ERROR,
              message: "Slug cannot be empty",
              field: "slug",
            },
          };
        }

        // Check for duplicate slug (excluding current version) - now globally unique
        if (trimmedSlug !== existing.slug) {
          const duplicate = await ctx.prisma.gameVersion.findUnique({
            where: { slug: trimmedSlug },
          });

          if (duplicate) {
            return {
              success: false,
              gameVersionId: null,
              error: {
                code: ErrorCode.ALREADY_EXISTS,
                message: `A version with slug "${trimmedSlug}" already exists`,
                field: "slug",
              },
            };
          }
        }
        updateData.slug = trimmedSlug;
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

      if (input.dlcIds !== undefined) {
        updateData.dlcs = {
          set: (input.dlcIds ?? []).map((id) => ({ id })),
        };
      }

      // Handle gameIds update - validate all games exist if provided
      if (input.gameIds !== undefined && input.gameIds !== null) {
        if (input.gameIds.length === 0) {
          return {
            success: false,
            gameVersionId: null,
            error: {
              code: ErrorCode.VALIDATION_ERROR,
              message: "At least one game must be linked",
              field: "gameIds",
            },
          };
        }

        const games = await ctx.prisma.game.findMany({
          where: { id: { in: input.gameIds } },
          select: { id: true },
        });

        if (games.length !== input.gameIds.length) {
          const foundIds = new Set(games.map(g => g.id));
          const missingIds = input.gameIds.filter(id => !foundIds.has(id));
          return {
            success: false,
            gameVersionId: null,
            error: {
              code: ErrorCode.NOT_FOUND,
              message: `Game(s) not found: ${missingIds.join(", ")}`,
              field: "gameIds",
            },
          };
        }

        updateData.games = {
          set: input.gameIds.map((id) => ({ id })),
        };
      }

      // Update version
      const version = await ctx.prisma.gameVersion.update({
        where: { id },
        data: updateData,
      });

      return {
        success: true,
        gameVersionId: version.id,
        error: null,
      };
    },
  })
);

// Delete game version mutation
builder.mutationField("deleteGameVersion", (t) =>
  t.field({
    type: DeleteGameVersionResult,
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
            message: "You must be logged in to delete a game version",
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
            message: "You do not have permission to delete game versions",
            field: null,
          },
        };
      }

      const { id } = args;

      // Check if version exists
      const existing = await ctx.prisma.gameVersion.findUnique({
        where: { id },
      });

      if (!existing) {
        return {
          success: false,
          deletedId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Game version with id "${id}" not found`,
            field: null,
          },
        };
      }

      // Cannot delete default version
      if (existing.isDefault) {
        return {
          success: false,
          deletedId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "Cannot delete the default version. Set another version as default first.",
            field: null,
          },
        };
      }

      // Delete version (related records will have gameVersionId set to null due to SetNull)
      await ctx.prisma.gameVersion.delete({
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

// Set default version mutation
builder.mutationField("setDefaultVersion", (t) =>
  t.field({
    type: GameVersionMutationResult,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          gameVersionId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to set the default version",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          gameVersionId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to set the default version",
            field: null,
          },
        };
      }

      const { id } = args;

      // Check if version exists
      const existing = await ctx.prisma.gameVersion.findUnique({
        where: { id },
      });

      if (!existing) {
        return {
          success: false,
          gameVersionId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Game version with id "${id}" not found`,
            field: null,
          },
        };
      }

      // Use transaction to ensure atomicity - now globally unset/set default
      await ctx.prisma.$transaction([
        // Unset all current defaults globally
        ctx.prisma.gameVersion.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        }),
        // Set new default
        ctx.prisma.gameVersion.update({
          where: { id },
          data: { isDefault: true },
        }),
      ]);

      return {
        success: true,
        gameVersionId: id,
        error: null,
      };
    },
  })
);

// Bulk delete game versions mutation
builder.mutationField("bulkDeleteGameVersions", (t) =>
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
            message: "You must be logged in to delete game versions",
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
            message: "You do not have permission to delete game versions",
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
            message: "At least one game version ID is required",
            field: "ids",
          },
        };
      }

      // Check if any of the versions are default
      const defaultVersions = await ctx.prisma.gameVersion.findMany({
        where: { id: { in: ids }, isDefault: true },
      });

      if (defaultVersions.length > 0) {
        return {
          success: false,
          deletedCount: 0,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "Cannot delete default versions. Set other versions as default first.",
            field: "ids",
          },
        };
      }

      const result = await ctx.prisma.gameVersion.deleteMany({
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
