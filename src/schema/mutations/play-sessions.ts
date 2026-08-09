import { GameStatus } from "@prisma/client";
import { builder, MutationErrorRef } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";

const PlaySessionMutationResult = builder.objectRef<{
  success: boolean;
  playSessionId: string | null;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("PlaySessionMutationResult");

PlaySessionMutationResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    playSession: t.prismaField({
      type: "PlaySession",
      nullable: true,
      resolve: async (query, result, _args, ctx) => {
        if (!result.playSessionId) return null;
        return ctx.prisma.playSession.findUnique({
          ...query,
          where: { id: result.playSessionId },
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

const LogPlaySessionInput = builder.inputType("LogPlaySessionInput", {
  fields: (t) => ({
    gameId: t.id({ required: true }),
    playedOn: t.field({ type: "DateTime", required: true }),
    minutes: t.int({ required: true }),
    notes: t.string({ required: false }),
    // Bump the game's library status to PLAYING (never downgrading a
    // COMPLETED/DROPPED entry); creates the library entry if missing.
    updateLibraryStatus: t.boolean({ required: false, defaultValue: true }),
  }),
});

const UpdatePlaySessionInput = builder.inputType("UpdatePlaySessionInput", {
  fields: (t) => ({
    playedOn: t.field({ type: "DateTime", required: false }),
    minutes: t.int({ required: false }),
    notes: t.string({ required: false }),
  }),
});

function validMinutes(minutes: number): boolean {
  return minutes >= 1 && minutes <= 1440;
}

builder.mutationField("logPlaySession", (t) =>
  t.field({
    type: PlaySessionMutationResult,
    args: {
      input: t.arg({ type: LogPlaySessionInput, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          playSessionId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to log play sessions",
            field: null,
          },
        };
      }

      const { gameId, playedOn, minutes, notes, updateLibraryStatus } = args.input;

      if (!validMinutes(minutes)) {
        return {
          success: false,
          playSessionId: null,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "Minutes must be between 1 and 1440",
            field: "minutes",
          },
        };
      }

      const game = await ctx.prisma.game.findUnique({
        where: { id: String(gameId) },
        select: { id: true, platformId: true },
      });

      if (!game) {
        return {
          success: false,
          playSessionId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Game with id "${gameId}" not found`,
            field: "gameId",
          },
        };
      }

      const session = await ctx.prisma.playSession.create({
        data: {
          userId: ctx.user.id,
          gameId: game.id,
          playedOn,
          minutes,
          notes: notes ?? null,
        },
      });

      if (updateLibraryStatus) {
        const existing = await ctx.prisma.userGame.findUnique({
          where: {
            userId_gameId: { userId: ctx.user.id, gameId: game.id },
          },
        });

        if (!existing) {
          await ctx.prisma.userGame.create({
            data: {
              userId: ctx.user.id,
              gameId: game.id,
              platformId: game.platformId,
              status: GameStatus.PLAYING,
            },
          });
        } else if (
          existing.status === GameStatus.BACKLOG ||
          existing.status === GameStatus.PAUSED
        ) {
          await ctx.prisma.userGame.update({
            where: { id: existing.id },
            data: { status: GameStatus.PLAYING },
          });
        }
      }

      return {
        success: true,
        playSessionId: session.id,
        error: null,
      };
    },
  })
);

builder.mutationField("updatePlaySession", (t) =>
  t.field({
    type: PlaySessionMutationResult,
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: UpdatePlaySessionInput, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          playSessionId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to update play sessions",
            field: null,
          },
        };
      }

      const existing = await ctx.prisma.playSession.findUnique({
        where: { id: String(args.id) },
      });

      if (!existing || existing.userId !== ctx.user.id) {
        return {
          success: false,
          playSessionId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: "Play session not found",
            field: null,
          },
        };
      }

      const { playedOn, minutes, notes } = args.input;

      if (minutes !== null && minutes !== undefined && !validMinutes(minutes)) {
        return {
          success: false,
          playSessionId: null,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "Minutes must be between 1 and 1440",
            field: "minutes",
          },
        };
      }

      await ctx.prisma.playSession.update({
        where: { id: existing.id },
        data: {
          ...(playedOn ? { playedOn } : {}),
          ...(minutes !== null && minutes !== undefined ? { minutes } : {}),
          ...(notes !== undefined ? { notes } : {}),
        },
      });

      return {
        success: true,
        playSessionId: existing.id,
        error: null,
      };
    },
  })
);

builder.mutationField("deletePlaySession", (t) =>
  t.field({
    type: PlaySessionMutationResult,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          playSessionId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to delete play sessions",
            field: null,
          },
        };
      }

      const existing = await ctx.prisma.playSession.findUnique({
        where: { id: String(args.id) },
      });

      if (!existing || existing.userId !== ctx.user.id) {
        return {
          success: false,
          playSessionId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: "Play session not found",
            field: null,
          },
        };
      }

      await ctx.prisma.playSession.delete({ where: { id: existing.id } });

      return {
        success: true,
        playSessionId: existing.id,
        error: null,
      };
    },
  })
);
