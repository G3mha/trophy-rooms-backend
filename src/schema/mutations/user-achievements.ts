import { builder } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";
import { requireAuth } from "../../context.js";
import {
  UserAchievementMutationResult,
  DeleteResult,
} from "../types/user-achievement.js";

// Mark achievement as complete
builder.mutationField("markAchievementComplete", (t) =>
  t.field({
    type: UserAchievementMutationResult,
    args: {
      achievementId: t.arg.id({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      // Require authentication
      let user;
      try {
        user = requireAuth(ctx);
      } catch {
        return {
          success: false,
          userAchievementId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to mark achievements",
            field: null,
          },
        };
      }

      const { achievementId } = args;

      // Check if achievement exists
      const achievement = await ctx.prisma.achievement.findUnique({
        where: { id: achievementId },
      });

      if (!achievement) {
        return {
          success: false,
          userAchievementId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Achievement with id "${achievementId}" not found`,
            field: "achievementId",
          },
        };
      }

      // Check if already completed
      const existing = await ctx.prisma.userAchievement.findUnique({
        where: {
          userId_achievementId: {
            userId: user.id,
            achievementId,
          },
        },
      });

      if (existing) {
        return {
          success: false,
          userAchievementId: null,
          error: {
            code: ErrorCode.ALREADY_EXISTS,
            message: "You have already completed this achievement",
            field: null,
          },
        };
      }

      // Create user achievement
      const userAchievement = await ctx.prisma.userAchievement.create({
        data: {
          userId: user.id,
          achievementId,
        },
      });

      return {
        success: true,
        userAchievementId: userAchievement.id,
        error: null,
      };
    },
  })
);

// Unmark achievement (remove completion)
builder.mutationField("unmarkAchievementComplete", (t) =>
  t.field({
    type: DeleteResult,
    args: {
      achievementId: t.arg.id({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      // Require authentication
      let user;
      try {
        user = requireAuth(ctx);
      } catch {
        return {
          success: false,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to manage achievements",
            field: null,
          },
        };
      }

      const { achievementId } = args;

      // Check if user achievement exists
      const existing = await ctx.prisma.userAchievement.findUnique({
        where: {
          userId_achievementId: {
            userId: user.id,
            achievementId,
          },
        },
      });

      if (!existing) {
        return {
          success: false,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: "You have not completed this achievement",
            field: null,
          },
        };
      }

      // Delete user achievement
      await ctx.prisma.userAchievement.delete({
        where: { id: existing.id },
      });

      return {
        success: true,
        error: null,
      };
    },
  })
);
