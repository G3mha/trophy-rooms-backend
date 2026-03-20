import { builder, BulkDeleteResultRef } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";
import {
  CreateGameInput,
  UpdateGameInput,
  GameMutationResult,
  DeleteGameResult,
} from "../types/game.js";
import { hasRequiredRole } from "../../context.js";
import { UserRole } from "@prisma/client";

// Create game mutation
builder.mutationField("createGame", (t) =>
  t.field({
    type: GameMutationResult,
    args: {
      input: t.arg({ type: CreateGameInput, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          gameId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to create a game",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          gameId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to create games",
            field: null,
          },
        };
      }

      const { title, description, coverUrl, releaseDate, developer, publisher, genre, esrbRating, screenshots } = args.input;
      const platformId = args.input.platformId ?? null;

      // Validate title
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        return {
          success: false,
          gameId: null,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "Title is required",
            field: "title",
          },
        };
      }

      // Check for duplicate title
      const existing = await ctx.prisma.game.findFirst({
        where: {
          title: trimmedTitle,
          platformId,
        },
      });

      if (existing) {
        return {
          success: false,
          gameId: null,
          error: {
            code: ErrorCode.ALREADY_EXISTS,
            message: `A game with title "${trimmedTitle}" already exists`,
            field: "title",
          },
        };
      }

      // Create game
      const game = await ctx.prisma.game.create({
        data: {
          title: trimmedTitle,
          description: description?.trim() || null,
          coverUrl: coverUrl?.trim() || null,
          releaseDate: releaseDate ?? null,
          developer: developer?.trim() || null,
          publisher: publisher?.trim() || null,
          genre: genre?.trim() || null,
          esrbRating: esrbRating?.trim() || null,
          screenshots: screenshots ?? [],
          platformId,
        },
      });

      return {
        success: true,
        gameId: game.id,
        error: null,
      };
    },
  })
);

// Update game mutation
builder.mutationField("updateGame", (t) =>
  t.field({
    type: GameMutationResult,
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: UpdateGameInput, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          gameId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to update a game",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          gameId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to update games",
            field: null,
          },
        };
      }

      const { id, input } = args;

      // Check if game exists
      const existing = await ctx.prisma.game.findUnique({
        where: { id },
      });

      if (!existing) {
        return {
          success: false,
          gameId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Game with id "${id}" not found`,
            field: null,
          },
        };
      }

      // Build update data
      const updateData: {
        title?: string;
        description?: string | null;
        coverUrl?: string | null;
        releaseDate?: Date | null;
        developer?: string | null;
        publisher?: string | null;
        genre?: string | null;
        esrbRating?: string | null;
        screenshots?: string[];
        platformId?: string | null;
      } = {};

      if (input.title !== undefined && input.title !== null) {
        const trimmedTitle = input.title.trim();
        if (!trimmedTitle) {
          return {
            success: false,
            gameId: null,
            error: {
              code: ErrorCode.VALIDATION_ERROR,
              message: "Title cannot be empty",
              field: "title",
            },
          };
        }

        // Check for duplicate title (excluding current game)
        if (trimmedTitle !== existing.title || input.platformId !== undefined) {
          const nextPlatformId =
            input.platformId !== undefined ? input.platformId ?? null : existing.platformId;
          const duplicate = await ctx.prisma.game.findFirst({
            where: {
              title: trimmedTitle,
              platformId: nextPlatformId,
            },
          });

          if (duplicate) {
            return {
              success: false,
              gameId: null,
              error: {
                code: ErrorCode.ALREADY_EXISTS,
                message: `A game with title "${trimmedTitle}" already exists`,
                field: "title",
              },
            };
          }
        }

        updateData.title = trimmedTitle;
      }

      if (input.title === undefined && input.platformId !== undefined) {
        const nextPlatformId = input.platformId ?? null;
        const duplicate = await ctx.prisma.game.findFirst({
          where: {
            title: existing.title,
            platformId: nextPlatformId,
          },
        });

        if (duplicate) {
          return {
            success: false,
            gameId: null,
            error: {
              code: ErrorCode.ALREADY_EXISTS,
              message: `A game with title "${existing.title}" already exists for this platform`,
              field: "platformId",
            },
          };
        }
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

      if (input.developer !== undefined) {
        updateData.developer = input.developer?.trim() || null;
      }

      if (input.publisher !== undefined) {
        updateData.publisher = input.publisher?.trim() || null;
      }

      if (input.genre !== undefined) {
        updateData.genre = input.genre?.trim() || null;
      }

      if (input.esrbRating !== undefined) {
        updateData.esrbRating = input.esrbRating?.trim() || null;
      }

      if (input.screenshots !== undefined) {
        updateData.screenshots = input.screenshots ?? [];
      }

      if (input.platformId !== undefined) {
        updateData.platformId = input.platformId ?? null;
      }

      // Update game
      const game = await ctx.prisma.game.update({
        where: { id },
        data: updateData,
      });

      return {
        success: true,
        gameId: game.id,
        error: null,
      };
    },
  })
);

// Delete game mutation
builder.mutationField("deleteGame", (t) =>
  t.field({
    type: DeleteGameResult,
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
            message: "You must be logged in to delete a game",
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
            message: "You do not have permission to delete games",
            field: null,
          },
        };
      }

      const { id } = args;

      // Check if game exists
      const existing = await ctx.prisma.game.findUnique({
        where: { id },
      });

      if (!existing) {
        return {
          success: false,
          deletedId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Game with id "${id}" not found`,
            field: null,
          },
        };
      }

      // Delete game (cascade will delete related records)
      await ctx.prisma.game.delete({
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

// Bulk delete games mutation
builder.mutationField("bulkDeleteGames", (t) =>
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
            message: "You must be logged in to delete games",
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
            message: "You do not have permission to delete games",
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
            message: "At least one game ID is required",
            field: "ids",
          },
        };
      }

      const result = await ctx.prisma.game.deleteMany({
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
