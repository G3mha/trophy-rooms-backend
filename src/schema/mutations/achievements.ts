import { builder } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";
import {
  CreateAchievementInput,
  AchievementMutationResult,
} from "../types/achievement.js";

// Create achievement mutation
builder.mutationField("createAchievement", (t) =>
  t.field({
    type: AchievementMutationResult,
    args: {
      input: t.arg({ type: CreateAchievementInput, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const { title, description, iconUrl, gameId } = args.input;

      // Validate title
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        return {
          success: false,
          achievementId: null,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "Title is required",
            field: "title",
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
          achievementId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Game with id "${gameId}" not found`,
            field: "gameId",
          },
        };
      }

      // Check for duplicate achievement title within the same game
      const existing = await ctx.prisma.achievement.findUnique({
        where: {
          gameId_title: {
            gameId,
            title: trimmedTitle,
          },
        },
      });

      if (existing) {
        return {
          success: false,
          achievementId: null,
          error: {
            code: ErrorCode.ALREADY_EXISTS,
            message: `An achievement with title "${trimmedTitle}" already exists for this game`,
            field: "title",
          },
        };
      }

      // Create achievement
      const achievement = await ctx.prisma.achievement.create({
        data: {
          title: trimmedTitle,
          description: description?.trim() || null,
          iconUrl: iconUrl?.trim() || null,
          gameId,
        },
      });

      return {
        success: true,
        achievementId: achievement.id,
        error: null,
      };
    },
  })
);
