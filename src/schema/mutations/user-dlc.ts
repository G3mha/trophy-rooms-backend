import { builder } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";
import { UserDLCMutationResult } from "../types/dlc.js";

// Add DLC to user's owned DLCs
builder.mutationField("addDLCToOwned", (t) =>
  t.field({
    type: UserDLCMutationResult,
    args: {
      dlcId: t.arg.id({ required: true }),
    },
    resolve: async (_root, { dlcId }, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          userDlcId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to add DLC to your collection",
            field: null,
          },
        };
      }

      // Check if DLC exists
      const dlc = await ctx.prisma.dLC.findUnique({
        where: { id: dlcId },
      });

      if (!dlc) {
        return {
          success: false,
          userDlcId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `DLC with id "${dlcId}" not found`,
            field: "dlcId",
          },
        };
      }

      // Check if already owned
      const existing = await ctx.prisma.userDLC.findUnique({
        where: {
          userId_dlcId: {
            userId: ctx.user.id,
            dlcId,
          },
        },
      });

      if (existing) {
        return {
          success: true,
          userDlcId: existing.id,
          error: null,
        };
      }

      // Create UserDLC
      const userDlc = await ctx.prisma.userDLC.create({
        data: {
          userId: ctx.user.id,
          dlcId,
        },
      });

      return {
        success: true,
        userDlcId: userDlc.id,
        error: null,
      };
    },
  })
);

// Remove DLC from user's owned DLCs
builder.mutationField("removeDLCFromOwned", (t) =>
  t.field({
    type: UserDLCMutationResult,
    args: {
      dlcId: t.arg.id({ required: true }),
    },
    resolve: async (_root, { dlcId }, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          userDlcId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to remove DLC from your collection",
            field: null,
          },
        };
      }

      // Check if ownership exists
      const existing = await ctx.prisma.userDLC.findUnique({
        where: {
          userId_dlcId: {
            userId: ctx.user.id,
            dlcId,
          },
        },
      });

      if (!existing) {
        return {
          success: true,
          userDlcId: null,
          error: null,
        };
      }

      // Delete UserDLC
      await ctx.prisma.userDLC.delete({
        where: {
          userId_dlcId: {
            userId: ctx.user.id,
            dlcId,
          },
        },
      });

      return {
        success: true,
        userDlcId: existing.id,
        error: null,
      };
    },
  })
);
