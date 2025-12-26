import { builder, MutationErrorRef } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";

builder.prismaObject("UserAchievement", {
  fields: (t) => ({
    id: t.exposeID("id"),
    user: t.relation("user"),
    userId: t.exposeString("userId"),
    achievement: t.relation("achievement"),
    achievementId: t.exposeString("achievementId"),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
  }),
});

// UserAchievement mutation result type
export const UserAchievementMutationResult = builder.objectRef<{
  success: boolean;
  userAchievementId: string | null;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("UserAchievementMutationResult");

UserAchievementMutationResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    userAchievement: t.prismaField({
      type: "UserAchievement",
      nullable: true,
      resolve: async (query, result, _args, ctx) => {
        if (!result.userAchievementId) return null;
        return ctx.prisma.userAchievement.findUnique({
          ...query,
          where: { id: result.userAchievementId },
        });
      },
    }),
    error: t.field({
      type: MutationErrorRef,
      nullable: true,
      resolve: (result) => result.error,
    }),
  }),
});

// Generic delete result
export const DeleteResult = builder.objectRef<{
  success: boolean;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("DeleteResult");

DeleteResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    error: t.field({
      type: MutationErrorRef,
      nullable: true,
      resolve: (result) => result.error,
    }),
  }),
});
