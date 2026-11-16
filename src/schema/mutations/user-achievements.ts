import { AchievementTier } from "@prisma/client";
import { builder } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";
import { requireAuth } from "../../context.js";
import {
  UserAchievementMutationResult,
  DeleteResult,
} from "../types/user-achievement.js";
import { awardTrophyIfComplete, notPlatinum, trophyEligibleSetWhere } from "../../lib/trophies.js";
import { visibleSetWhere } from "../../lib/achievement-visibility.js";

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
            message: "You must be logged in to mark trophies",
            field: null,
          },
        };
      }

      const { achievementId } = args;

      // Check if achievement exists. One in another user's private set reads
      // as missing, so it can't be completed or confirmed to exist.
      const achievement = await ctx.prisma.achievement.findFirst({
        where: { id: achievementId, achievementSet: visibleSetWhere(user) },
      });

      if (!achievement) {
        return {
          success: false,
          userAchievementId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Trophy with id "${achievementId}" not found`,
            field: "achievementId",
          },
        };
      }

      // The Platinum is awarded by finishing the list, never ticked by hand
      if (achievement.tier === AchievementTier.PLATINUM) {
        return {
          success: false,
          userAchievementId: null,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "Finish every trophy in the list to earn the Platinum",
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
            message: "You have already completed this trophy",
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

      const achievementWithSet = await ctx.prisma.achievement.findUnique({
        where: { id: achievementId },
        select: {
          achievementSet: {
            select: {
              gameFamilyId: true,
            },
          },
        },
      });

      // A set without a family would match every unlinked game below
      const gameFamilyId = achievementWithSet?.achievementSet.gameFamilyId;
      if (gameFamilyId) await awardTrophyIfComplete(ctx.prisma, user.id, gameFamilyId);

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
            message: "You must be logged in to manage trophies",
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
        include: { achievement: { select: { tier: true } } },
      });

      if (!existing) {
        return {
          success: false,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: "You have not completed this trophy",
            field: null,
          },
        };
      }

      // The Platinum only goes when a trophy in the list is unticked, below
      if (existing.achievement.tier === AchievementTier.PLATINUM) {
        return {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "Untick a trophy in the list to give up the Platinum",
            field: "achievementId",
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
              gameFamilyId: true,
            },
          },
        },
      });

      if (achievementWithSet?.achievementSet) {
        const gameFamilyId = achievementWithSet.achievementSet.gameFamilyId;
        const totalAchievements = await ctx.prisma.achievement.count({
          where: {
            ...notPlatinum,
            achievementSet: {
              gameFamilyId,
              ...trophyEligibleSetWhere,
            },
          },
        });

        if (totalAchievements > 0) {
          const completedCount = await ctx.prisma.userAchievement.count({
            where: {
              userId: user.id,
              achievement: {
                ...notPlatinum,
                achievementSet: {
                  gameFamilyId,
                  ...trophyEligibleSetWhere,
                },
              },
            },
          });

          if (completedCount < totalAchievements) {
            // Remove trophies for all games in this family
            const gamesInFamily = await ctx.prisma.game.findMany({
              where: { gameFamilyId },
              select: { id: true },
            });

            await ctx.prisma.trophy.deleteMany({
              where: {
                userId: user.id,
                gameId: { in: gamesInFamily.map((g) => g.id) },
              },
            });

            // The Platinum is the trophy, so it goes with it
            await ctx.prisma.userAchievement.deleteMany({
              where: {
                userId: user.id,
                achievement: {
                  tier: AchievementTier.PLATINUM,
                  achievementSet: { gameFamilyId, ...trophyEligibleSetWhere },
                },
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
