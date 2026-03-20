import { builder, BulkDeleteResultRef } from "../builder.js";
import {
  CreateAchievementSetInput,
  UpdateAchievementSetInput,
  AchievementSetMutationResult,
} from "../types/achievement-set.js";
import { ErrorCode } from "../../lib/errors.js";
import { hasRequiredRole } from "../../context.js";
import {
  AchievementSetVisibility,
  AchievementSetType,
  UserRole,
} from "@prisma/client";

builder.mutationField("createAchievementSet", (t) =>
  t.field({
    type: AchievementSetMutationResult,
    args: {
      input: t.arg({ type: CreateAchievementSetInput, required: true }),
    },
    resolve: async (_root, { input }, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          achievementSetId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to create an achievement set",
            field: null,
          },
        };
      }

      const trimmedTitle = input.title?.trim() ?? "";
      if (!trimmedTitle) {
        return {
          success: false,
          achievementSetId: null,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "Title is required",
            field: "title",
          },
        };
      }

      const game = await ctx.prisma.game.findUnique({
        where: { id: input.gameId },
      });

      if (!game) {
        return {
          success: false,
          achievementSetId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Game with id "${input.gameId}" not found`,
            field: "gameId",
          },
        };
      }

      if (
        input.type !== AchievementSetType.CUSTOM &&
        !hasRequiredRole(ctx.user, UserRole.TRUSTED)
      ) {
        return {
          success: false,
          achievementSetId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to create official sets",
            field: null,
          },
        };
      }

      const duplicateWhere =
        input.type === AchievementSetType.CUSTOM
          ? {
              gameId: input.gameId,
              title: trimmedTitle,
              type: AchievementSetType.CUSTOM,
              createdByUserId: ctx.user.id,
            }
          : {
              gameId: input.gameId,
              title: trimmedTitle,
              type: input.type,
            };

      const existing = await ctx.prisma.achievementSet.findFirst({
        where: duplicateWhere,
      });

      if (existing) {
        return {
          success: false,
          achievementSetId: null,
          error: {
            code: ErrorCode.ALREADY_EXISTS,
            message: `An achievement set named "${trimmedTitle}" already exists for this game`,
            field: "title",
          },
        };
      }

      const visibility =
        input.type === AchievementSetType.CUSTOM
          ? AchievementSetVisibility.PRIVATE
          : AchievementSetVisibility.PUBLIC;

      const achievementSet = await ctx.prisma.achievementSet.create({
        data: {
          title: trimmedTitle,
          type: input.type,
          visibility,
          gameId: input.gameId,
          createdByUserId: ctx.user.id,
        },
      });

      return {
        success: true,
        achievementSetId: achievementSet.id,
        error: null,
      };
    },
  })
);

builder.mutationField("updateAchievementSet", (t) =>
  t.field({
    type: AchievementSetMutationResult,
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: UpdateAchievementSetInput, required: true }),
    },
    resolve: async (_root, { id, input }, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          achievementSetId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to update an achievement set",
            field: null,
          },
        };
      }

      const existing = await ctx.prisma.achievementSet.findUnique({
        where: { id },
      });

      if (!existing) {
        return {
          success: false,
          achievementSetId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Achievement set with id "${id}" not found`,
            field: null,
          },
        };
      }

      const isAdmin = hasRequiredRole(ctx.user, UserRole.ADMIN);
      const isTrusted = hasRequiredRole(ctx.user, UserRole.TRUSTED);
      const isOwner = existing.createdByUserId === ctx.user.id;

      if (existing.type === AchievementSetType.CUSTOM) {
        if (!isOwner && !isAdmin) {
          return {
            success: false,
            achievementSetId: null,
            error: {
              code: ErrorCode.FORBIDDEN,
              message: "You do not have permission to update this custom set",
              field: null,
            },
          };
        }
      } else if (!isTrusted) {
        return {
          success: false,
          achievementSetId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to update this set",
            field: null,
          },
        };
      }

      const updateData: {
        title?: string;
        visibility?: AchievementSetVisibility;
      } = {};

      if (input.title != null) {
        const trimmedTitle = input.title.trim();
        if (!trimmedTitle) {
          return {
            success: false,
            achievementSetId: null,
            error: {
              code: ErrorCode.VALIDATION_ERROR,
              message: "Title cannot be empty",
              field: "title",
            },
          };
        }
        if (trimmedTitle !== existing.title) {
          const duplicateWhere =
            existing.type === AchievementSetType.CUSTOM
              ? {
                  gameId: existing.gameId,
                  title: trimmedTitle,
                  type: existing.type,
                  createdByUserId: existing.createdByUserId,
                }
              : {
                  gameId: existing.gameId,
                  title: trimmedTitle,
                  type: existing.type,
                };

          const duplicate = await ctx.prisma.achievementSet.findFirst({
            where: {
              ...duplicateWhere,
              NOT: { id },
            },
          });

          if (duplicate) {
            return {
              success: false,
              achievementSetId: null,
              error: {
                code: ErrorCode.ALREADY_EXISTS,
                message: `An achievement set named "${trimmedTitle}" already exists for this game`,
                field: "title",
              },
            };
          }
        }
        updateData.title = trimmedTitle;
      }

      if (input.visibility != null) {
        if (existing.type !== AchievementSetType.CUSTOM) {
          return {
            success: false,
            achievementSetId: null,
            error: {
              code: ErrorCode.FORBIDDEN,
              message: "Only custom sets can change visibility",
              field: "visibility",
            },
          };
        }

        if (!isOwner && !isAdmin) {
          return {
            success: false,
            achievementSetId: null,
            error: {
              code: ErrorCode.FORBIDDEN,
              message: "You do not have permission to change visibility",
              field: null,
            },
          };
        }

        updateData.visibility = input.visibility;
      }

      const updated = await ctx.prisma.achievementSet.update({
        where: { id },
        data: updateData,
      });

      return {
        success: true,
        achievementSetId: updated.id,
        error: null,
      };
    },
  })
);

builder.mutationField("publishAchievementSet", (t) =>
  t.field({
    type: AchievementSetMutationResult,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: async (_root, { id }, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          achievementSetId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to publish an achievement set",
            field: null,
          },
        };
      }

      const existing = await ctx.prisma.achievementSet.findUnique({
        where: { id },
      });

      if (!existing) {
        return {
          success: false,
          achievementSetId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Achievement set with id "${id}" not found`,
            field: null,
          },
        };
      }

      const isAdmin = hasRequiredRole(ctx.user, UserRole.ADMIN);
      const isOwner = existing.createdByUserId === ctx.user.id;

      if (existing.type !== AchievementSetType.CUSTOM) {
        return {
          success: false,
          achievementSetId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "Only custom sets can be published",
            field: null,
          },
        };
      }

      if (!isOwner && !isAdmin) {
        return {
          success: false,
          achievementSetId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to publish this set",
            field: null,
          },
        };
      }

      const updated = await ctx.prisma.achievementSet.update({
        where: { id },
        data: {
          visibility: AchievementSetVisibility.PUBLIC,
        },
      });

      return {
        success: true,
        achievementSetId: updated.id,
        error: null,
      };
    },
  })
);

builder.mutationField("deleteAchievementSet", (t) =>
  t.field({
    type: AchievementSetMutationResult,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: async (_root, { id }, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          achievementSetId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to delete an achievement set",
            field: null,
          },
        };
      }

      const existing = await ctx.prisma.achievementSet.findUnique({
        where: { id },
      });

      if (!existing) {
        return {
          success: false,
          achievementSetId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Achievement set with id "${id}" not found`,
            field: null,
          },
        };
      }

      const isAdmin = hasRequiredRole(ctx.user, UserRole.ADMIN);
      const isTrusted = hasRequiredRole(ctx.user, UserRole.TRUSTED);
      const isOwner = existing.createdByUserId === ctx.user.id;

      if (existing.type === AchievementSetType.CUSTOM) {
        if (!isOwner && !isAdmin) {
          return {
            success: false,
            achievementSetId: null,
            error: {
              code: ErrorCode.FORBIDDEN,
              message: "You do not have permission to delete this custom set",
              field: null,
            },
          };
        }
      } else if (!isTrusted) {
        return {
          success: false,
          achievementSetId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to delete this set",
            field: null,
          },
        };
      }

      await ctx.prisma.achievementSet.delete({ where: { id } });

      return {
        success: true,
        achievementSetId: id,
        error: null,
      };
    },
  })
);

builder.mutationField("setAchievementSetType", (t) =>
  t.field({
    type: AchievementSetMutationResult,
    args: {
      id: t.arg.id({ required: true }),
      type: t.arg({ type: AchievementSetType, required: true }),
    },
    resolve: async (_root, { id, type }, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          achievementSetId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to change set type",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          achievementSetId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to change set type",
            field: null,
          },
        };
      }

      const existing = await ctx.prisma.achievementSet.findUnique({
        where: { id },
      });

      if (!existing) {
        return {
          success: false,
          achievementSetId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Achievement set with id "${id}" not found`,
            field: null,
          },
        };
      }

      const updated = await ctx.prisma.achievementSet.update({
        where: { id },
        data: {
          type,
          visibility:
            type === AchievementSetType.CUSTOM
              ? AchievementSetVisibility.PRIVATE
              : AchievementSetVisibility.PUBLIC,
        },
      });

      return {
        success: true,
        achievementSetId: updated.id,
        error: null,
      };
    },
  })
);

builder.mutationField("bulkDeleteAchievementSets", (t) =>
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
            message: "You must be logged in to delete achievement sets",
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
            message: "You do not have permission to delete achievement sets",
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
            message: "At least one achievement set ID is required",
            field: "ids",
          },
        };
      }

      const result = await ctx.prisma.achievementSet.deleteMany({
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
