import { builder, MutationErrorRef } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";

builder.prismaObject("GameVersion", {
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    slug: t.exposeString("slug"),
    description: t.exposeString("description", { nullable: true }),
    coverUrl: t.exposeString("coverUrl", { nullable: true }),
    releaseDate: t.expose("releaseDate", { type: "DateTime", nullable: true }),
    includedDlc: t.exposeStringList("includedDlc"),
    isDefault: t.exposeBoolean("isDefault"),
    game: t.relation("game"),
    gameId: t.exposeString("gameId"),
    achievementSets: t.relation("achievementSets", {
      query: {
        orderBy: { title: "asc" },
      },
    }),
    achievementSetCount: t.relationCount("achievementSets"),
    // Computed field: returns version coverUrl if set, otherwise falls back to game.coverUrl
    effectiveCoverUrl: t.string({
      nullable: true,
      resolve: async (version, _args, ctx) => {
        if (version.coverUrl) {
          return version.coverUrl;
        }
        const game = await ctx.prisma.game.findUnique({
          where: { id: version.gameId },
          select: { coverUrl: true },
        });
        return game?.coverUrl ?? null;
      },
    }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

// Input types for game version mutations
export const CreateGameVersionInput = builder.inputType("CreateGameVersionInput", {
  fields: (t) => ({
    gameId: t.id({ required: true }),
    name: t.string({ required: true }),
    slug: t.string({ required: true }),
    description: t.string(),
    coverUrl: t.string(),
    releaseDate: t.field({ type: "DateTime" }),
    includedDlc: t.stringList(),
    isDefault: t.boolean(),
  }),
});

export const UpdateGameVersionInput = builder.inputType("UpdateGameVersionInput", {
  fields: (t) => ({
    name: t.string(),
    slug: t.string(),
    description: t.string(),
    coverUrl: t.string(),
    releaseDate: t.field({ type: "DateTime" }),
    includedDlc: t.stringList(),
  }),
});

// Game version mutation result type
export const GameVersionMutationResult = builder.objectRef<{
  success: boolean;
  gameVersionId: string | null;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("GameVersionMutationResult");

GameVersionMutationResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    gameVersion: t.prismaField({
      type: "GameVersion",
      nullable: true,
      resolve: async (query, result, _args, ctx) => {
        if (!result.gameVersionId) return null;
        return ctx.prisma.gameVersion.findUnique({
          ...query,
          where: { id: result.gameVersionId },
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

// Delete result type
export const DeleteGameVersionResult = builder.objectRef<{
  success: boolean;
  deletedId: string | null;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("DeleteGameVersionResult");

DeleteGameVersionResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    deletedId: t.exposeID("deletedId", { nullable: true }),
    error: t.field({
      type: MutationErrorRef,
      nullable: true,
      resolve: (result) => result.error,
    }),
  }),
});
