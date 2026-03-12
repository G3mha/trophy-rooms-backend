import { GameStatus } from "@prisma/client";
import { builder, MutationErrorRef } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";
import { requireAuth } from "../../context.js";
import { GameStatusEnum } from "../types/user-game.js";

// UserGame mutation result type
const UserGameMutationResult = builder.objectRef<{
  success: boolean;
  userGameId: string | null;
  status: GameStatus | null;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("UserGameMutationResult");

UserGameMutationResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    userGameId: t.exposeString("userGameId", { nullable: true }),
    status: t.field({
      type: GameStatusEnum,
      nullable: true,
      resolve: (result) => result.status,
    }),
    error: t.field({
      type: MutationErrorRef,
      nullable: true,
      resolve: (result) => result.error,
    }),
  }),
});

// Clear status result type
const ClearStatusResult = builder.objectRef<{
  success: boolean;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("ClearStatusResult");

ClearStatusResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    error: t.field({
      type: MutationErrorRef,
      nullable: true,
      resolve: (result) => result.error,
    }),
  }),
});

// Set game status (upsert)
builder.mutationField("setGameStatus", (t) =>
  t.field({
    type: UserGameMutationResult,
    args: {
      gameId: t.arg.id({ required: true }),
      status: t.arg({ type: GameStatusEnum, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      // Require authentication
      let user;
      try {
        user = requireAuth(ctx);
      } catch {
        return {
          success: false,
          userGameId: null,
          status: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to set game status",
            field: null,
          },
        };
      }

      const { gameId, status } = args;

      // Check if game exists
      const game = await ctx.prisma.game.findUnique({
        where: { id: gameId },
      });

      if (!game) {
        return {
          success: false,
          userGameId: null,
          status: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Game with id "${gameId}" not found`,
            field: "gameId",
          },
        };
      }

      // Upsert the user game entry
      const userGame = await ctx.prisma.userGame.upsert({
        where: {
          userId_gameId: {
            userId: user.id,
            gameId,
          },
        },
        update: {
          status,
        },
        create: {
          userId: user.id,
          gameId,
          status,
        },
      });

      return {
        success: true,
        userGameId: userGame.id,
        status: userGame.status,
        error: null,
      };
    },
  })
);

// Clear game status (remove from library)
builder.mutationField("clearGameStatus", (t) =>
  t.field({
    type: ClearStatusResult,
    args: {
      gameId: t.arg.id({ required: true }),
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
            message: "You must be logged in to manage your library",
            field: null,
          },
        };
      }

      const { gameId } = args;

      // Check if entry exists
      const existing = await ctx.prisma.userGame.findUnique({
        where: {
          userId_gameId: {
            userId: user.id,
            gameId,
          },
        },
      });

      if (!existing) {
        return {
          success: false,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: "This game is not in your library",
            field: null,
          },
        };
      }

      // Remove from library
      await ctx.prisma.userGame.delete({
        where: { id: existing.id },
      });

      return {
        success: true,
        error: null,
      };
    },
  })
);
