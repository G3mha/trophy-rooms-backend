import { builder } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";
import { requireAuth } from "../../context.js";
import {
  UserAchievementMutationResult,
  DeleteResult,
} from "../types/user-achievement.js";
import { AchievementSetType, AchievementSetVisibility } from "@prisma/client";

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

      // Award trophy if all official/completionist achievements are complete
      const achievementWithSet = await ctx.prisma.achievement.findUnique({
        where: { id: achievementId },
        select: {
          achievementSet: {
            select: {
              gameId: true,
            },
          },
        },
      });

      if (achievementWithSet?.achievementSet) {
        const gameId = achievementWithSet.achievementSet.gameId;
        const totalAchievements = await ctx.prisma.achievement.count({
          where: {
            achievementSet: {
              gameId,
              OR: [
                { type: { in: [AchievementSetType.OFFICIAL, AchievementSetType.COMPLETIONIST] } },
                { type: AchievementSetType.CUSTOM, visibility: AchievementSetVisibility.PUBLIC },
              ],
            },
          },
        });

        if (totalAchievements > 0) {
          const completedCount = await ctx.prisma.userAchievement.count({
            where: {
              userId: user.id,
              achievement: {
                achievementSet: {
                  gameId,
                  OR: [
                    { type: { in: [AchievementSetType.OFFICIAL, AchievementSetType.COMPLETIONIST] } },
                    { type: AchievementSetType.CUSTOM, visibility: AchievementSetVisibility.PUBLIC },
                  ],
                },
              },
            },
          });

          if (completedCount >= totalAchievements) {
            await ctx.prisma.trophy.upsert({
              where: {
                userId_gameId: {
                  userId: user.id,
                  gameId,
                },
              },
              update: {},
              create: {
                userId: user.id,
                gameId,
              },
            });
          }
        }
      }

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

      // Remove trophy if no longer complete
      const achievementWithSet = await ctx.prisma.achievement.findUnique({
        where: { id: achievementId },
        select: {
          achievementSet: {
            select: {
              gameId: true,
            },
          },
        },
      });

      if (achievementWithSet?.achievementSet) {
        const gameId = achievementWithSet.achievementSet.gameId;
        const totalAchievements = await ctx.prisma.achievement.count({
          where: {
            achievementSet: {
              gameId,
              OR: [
                { type: { in: [AchievementSetType.OFFICIAL, AchievementSetType.COMPLETIONIST] } },
                { type: AchievementSetType.CUSTOM, visibility: AchievementSetVisibility.PUBLIC },
              ],
            },
          },
        });

        if (totalAchievements > 0) {
          const completedCount = await ctx.prisma.userAchievement.count({
            where: {
              userId: user.id,
              achievement: {
                achievementSet: {
                  gameId,
                  OR: [
                    { type: { in: [AchievementSetType.OFFICIAL, AchievementSetType.COMPLETIONIST] } },
                    { type: AchievementSetType.CUSTOM, visibility: AchievementSetVisibility.PUBLIC },
                  ],
                },
              },
            },
          });

          if (completedCount < totalAchievements) {
            await ctx.prisma.trophy.deleteMany({
              where: {
                userId: user.id,
                gameId,
              },
            });
          }
        }
      }

      return {
        success: true,
        error: null,
      };
    },
  })
);
