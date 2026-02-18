import { builder } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";
import {
  CreateAchievementInput,
  AchievementMutationResult,
  UpdateAchievementInput,
  BulkAchievementInput,
  BulkAchievementResult,
} from "../types/achievement.js";
import { hasRequiredRole } from "../../context.js";
import { AchievementSetType, UserRole } from "@prisma/client";

builder.mutationField("createAchievement", (t) =>
  t.field({
    type: AchievementMutationResult,
    args: {
      input: t.arg({ type: CreateAchievementInput, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          achievementId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to create an achievement",
            field: null,
          },
        };
      }

      const { title, description, iconUrl, points, tier, achievementSetId } = args.input;

      // Validate title
      const trimmedTitle = title?.trim() ?? "";
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

      // Check if achievement set exists
      const achievementSet = await ctx.prisma.achievementSet.findUnique({
        where: { id: achievementSetId },
      });

      if (!achievementSet) {
        return {
          success: false,
          achievementId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Achievement set with id "${achievementSetId}" not found`,
            field: "achievementSetId",
          },
        };
      }

      const isAdmin = hasRequiredRole(ctx.user, UserRole.ADMIN);
      const isTrusted = hasRequiredRole(ctx.user, UserRole.TRUSTED);
      const isOwner = achievementSet.createdByUserId === ctx.user.id;

      if (achievementSet.type === AchievementSetType.CUSTOM) {
        if (!isOwner && !isAdmin) {
          return {
            success: false,
            achievementId: null,
            error: {
              code: ErrorCode.FORBIDDEN,
              message: "You do not have permission to add achievements to this set",
              field: null,
            },
          };
        }
      } else if (!isTrusted) {
        return {
          success: false,
          achievementId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to add achievements to this set",
            field: null,
          },
        };
      }

      // Check for duplicate achievement title within the same set
      const existing = await ctx.prisma.achievement.findUnique({
        where: {
          achievementSetId_title: {
            achievementSetId,
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
            message: `An achievement with title "${trimmedTitle}" already exists for this set`,
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
          points: points ?? 0,
          tier: tier ?? "BRONZE",
          achievementSetId,
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

builder.mutationField("updateAchievement", (t) =>
  t.field({
    type: AchievementMutationResult,
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: UpdateAchievementInput, required: true }),
    },
    resolve: async (_root, { id, input }, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          achievementId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to update an achievement",
            field: null,
          },
        };
      }

      const existing = await ctx.prisma.achievement.findUnique({
        where: { id },
        include: { achievementSet: true },
      });

      if (!existing) {
        return {
          success: false,
          achievementId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Achievement with id "${id}" not found`,
            field: null,
          },
        };
      }

      const isAdmin = hasRequiredRole(ctx.user, UserRole.ADMIN);
      const isTrusted = hasRequiredRole(ctx.user, UserRole.TRUSTED);
      const isOwner = existing.achievementSet.createdByUserId === ctx.user.id;

      if (existing.achievementSet.type === AchievementSetType.CUSTOM) {
        if (!isOwner && !isAdmin) {
          return {
            success: false,
            achievementId: null,
            error: {
              code: ErrorCode.FORBIDDEN,
              message: "You do not have permission to update this achievement",
              field: null,
            },
          };
        }
      } else if (!isTrusted) {
        return {
          success: false,
          achievementId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to update this achievement",
            field: null,
          },
        };
      }

      if (input.title != null) {
        const trimmedTitle = input.title.trim();
        if (!trimmedTitle) {
          return {
            success: false,
            achievementId: null,
            error: {
              code: ErrorCode.VALIDATION_ERROR,
              message: "Title cannot be empty",
              field: "title",
            },
          };
        }

        if (trimmedTitle !== existing.title) {
          const duplicate = await ctx.prisma.achievement.findUnique({
            where: {
              achievementSetId_title: {
                achievementSetId: existing.achievementSetId,
                title: trimmedTitle,
              },
            },
          });

          if (duplicate) {
            return {
              success: false,
              achievementId: null,
              error: {
                code: ErrorCode.ALREADY_EXISTS,
                message: `An achievement with title "${trimmedTitle}" already exists for this set`,
                field: "title",
              },
            };
          }
        }
      }

      const updated = await ctx.prisma.achievement.update({
        where: { id },
        data: {
          title: input.title?.trim() || undefined,
          description: input.description?.trim() || undefined,
          iconUrl: input.iconUrl?.trim() || undefined,
          points: input.points ?? undefined,
          tier: input.tier ?? undefined,
        },
      });

      return {
        success: true,
        achievementId: updated.id,
        error: null,
      };
    },
  })
);

builder.mutationField("deleteAchievement", (t) =>
  t.field({
    type: AchievementMutationResult,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: async (_root, { id }, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          achievementId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to delete an achievement",
            field: null,
          },
        };
      }

      const existing = await ctx.prisma.achievement.findUnique({
        where: { id },
        include: { achievementSet: true },
      });

      if (!existing) {
        return {
          success: false,
          achievementId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Achievement with id "${id}" not found`,
            field: null,
          },
        };
      }

      const isAdmin = hasRequiredRole(ctx.user, UserRole.ADMIN);
      const isTrusted = hasRequiredRole(ctx.user, UserRole.TRUSTED);
      const isOwner = existing.achievementSet.createdByUserId === ctx.user.id;

      if (existing.achievementSet.type === AchievementSetType.CUSTOM) {
        if (!isOwner && !isAdmin) {
          return {
            success: false,
            achievementId: null,
            error: {
              code: ErrorCode.FORBIDDEN,
              message: "You do not have permission to delete this achievement",
              field: null,
            },
          };
        }
      } else if (!isTrusted) {
        return {
          success: false,
          achievementId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to delete this achievement",
            field: null,
          },
        };
      }

      await ctx.prisma.achievement.delete({ where: { id } });

      return {
        success: true,
        achievementId: id,
        error: null,
      };
    },
  })
);

builder.mutationField("bulkCreateAchievements", (t) =>
  t.field({
    type: BulkAchievementResult,
    args: {
      achievementSetId: t.arg.id({ required: true }),
      achievements: t.arg({ type: [BulkAchievementInput], required: true }),
    },
    resolve: async (_root, { achievementSetId, achievements }, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          createdCount: 0,
          skippedCount: 0,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to import achievements",
            field: null,
          },
        };
      }

      if (!achievements.length) {
        return {
          success: false,
          createdCount: 0,
          skippedCount: 0,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "No achievements provided",
            field: "achievements",
          },
        };
      }

      const achievementSet = await ctx.prisma.achievementSet.findUnique({
        where: { id: achievementSetId },
      });

      if (!achievementSet) {
        return {
          success: false,
          createdCount: 0,
          skippedCount: 0,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Achievement set with id "${achievementSetId}" not found`,
            field: "achievementSetId",
          },
        };
      }

      const isAdmin = hasRequiredRole(ctx.user, UserRole.ADMIN);
      const isTrusted = hasRequiredRole(ctx.user, UserRole.TRUSTED);
      const isOwner = achievementSet.createdByUserId === ctx.user.id;

      if (achievementSet.type === AchievementSetType.CUSTOM) {
        if (!isOwner && !isAdmin) {
          return {
            success: false,
            createdCount: 0,
            skippedCount: 0,
            error: {
              code: ErrorCode.FORBIDDEN,
              message: "You do not have permission to import into this set",
              field: null,
            },
          };
        }
      } else if (!isTrusted) {
        return {
          success: false,
          createdCount: 0,
          skippedCount: 0,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to import into this set",
            field: null,
          },
        };
      }

      const normalized = achievements
        .map((item) => ({
          title: item.title.trim(),
          description: item.description?.trim() || null,
          iconUrl: item.iconUrl?.trim() || null,
          points: item.points ?? 0,
          tier: item.tier ?? "BRONZE",
        }))
        .filter((item) => item.title.length > 0);

      if (!normalized.length) {
        return {
          success: false,
          createdCount: 0,
          skippedCount: 0,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "All achievements are empty",
            field: "achievements",
          },
        };
      }

      const result = await ctx.prisma.achievement.createMany({
        data: normalized.map((item) => ({
          ...item,
          achievementSetId,
        })),
        skipDuplicates: true,
      });

      return {
        success: true,
        createdCount: result.count,
        skippedCount: normalized.length - result.count,
        error: null,
      };
    },
  })
);
