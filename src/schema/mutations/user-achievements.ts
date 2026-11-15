import { builder } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";
import { requireAuth } from "../../context.js";
import {
  UserAchievementMutationResult,
  MarkAllAchievementsResult,
  DeleteResult,
} from "../types/user-achievement.js";
import { awardTrophyIfComplete, trophyEligibleSetWhere } from "../../lib/trophies.js";
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
            message: "You must be logged in to mark achievements",
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

// Mark every trophy-eligible achievement in a game family complete in one go,
// for a player who already finished the game elsewhere. Completions are
// self-reported one at a time anyway, so this claims nothing a patient user
// couldn't. Sets that don't gate the trophy are left alone.
builder.mutationField("markAllAchievementsComplete", (t) =>
  t.field({
    type: MarkAllAchievementsResult,
    args: {
      gameFamilyId: t.arg.id({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      let user;
      try {
        user = requireAuth(ctx);
      } catch {
        return {
          success: false,
          markedCount: 0,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to mark achievements",
            field: null,
          },
        };
      }

      const gameFamilyId = String(args.gameFamilyId);
      const achievements = await ctx.prisma.achievement.findMany({
        where: { achievementSet: { gameFamilyId, ...trophyEligibleSetWhere } },
        select: { id: true },
      });

      if (achievements.length === 0) {
        return {
          success: false,
          markedCount: 0,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: "This game has no achievements to complete",
            field: "gameFamilyId",
          },
        };
      }

      // Ones the user already ticked keep their original completion date
      const { count } = await ctx.prisma.userAchievement.createMany({
        data: achievements.map((achievement) => ({ userId: user.id, achievementId: achievement.id })),
        skipDuplicates: true,
      });

      await awardTrophyIfComplete(ctx.prisma, user.id, gameFamilyId);

      return { success: true, markedCount: count, error: null };
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
              gameFamilyId: true,
            },
          },
        },
      });

      if (achievementWithSet?.achievementSet) {
        const gameFamilyId = achievementWithSet.achievementSet.gameFamilyId;
        const totalAchievements = await ctx.prisma.achievement.count({
          where: {
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
