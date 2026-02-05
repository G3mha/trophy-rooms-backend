import { builder, MutationErrorRef } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";
import { hasRequiredRole } from "../../context.js";
import { UserRole } from "@prisma/client";

const UserRoleMutationResult = builder.objectRef<{
  success: boolean;
  userId: string | null;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("UserRoleMutationResult");

UserRoleMutationResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    user: t.prismaField({
      type: "User",
      nullable: true,
      resolve: async (query, result, _args, ctx) => {
        if (!result.userId) return null;
        return ctx.prisma.user.findUnique({
          ...query,
          where: { id: result.userId },
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

builder.mutationField("setUserRole", (t) =>
  t.field({
    type: UserRoleMutationResult,
    args: {
      userId: t.arg.id({ required: true }),
      role: t.arg({ type: "UserRole", required: true }),
    },
    resolve: async (_root, { userId, role }, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          userId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to update roles",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.ADMIN)) {
        return {
          success: false,
          userId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to update roles",
            field: null,
          },
        };
      }

      const user = await ctx.prisma.user.findUnique({ where: { id: userId } });

      if (!user) {
        return {
          success: false,
          userId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `User with id "${userId}" not found`,
            field: "userId",
          },
        };
      }

      const updated = await ctx.prisma.user.update({
        where: { id: userId },
        data: { role },
      });

      return {
        success: true,
        userId: updated.id,
        error: null,
      };
    },
  })
);
