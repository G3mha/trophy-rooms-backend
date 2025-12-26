import { builder } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";
import {
  CreateGameInput,
  UpdateGameInput,
  GameMutationResult,
  DeleteGameResult,
} from "../types/game.js";

// Create game mutation
builder.mutationField("createGame", (t) =>
  t.field({
    type: GameMutationResult,
    args: {
      input: t.arg({ type: CreateGameInput, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const { title, description, coverUrl } = args.input;

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
      const existing = await ctx.prisma.game.findUnique({
        where: { title: trimmedTitle },
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
        if (trimmedTitle !== existing.title) {
          const duplicate = await ctx.prisma.game.findUnique({
            where: { title: trimmedTitle },
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

      if (input.description !== undefined) {
        updateData.description = input.description?.trim() || null;
      }

      if (input.coverUrl !== undefined) {
        updateData.coverUrl = input.coverUrl?.trim() || null;
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
