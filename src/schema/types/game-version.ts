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
    isDefault: t.exposeBoolean("isDefault"),
    dlcs: t.relation("dlcs", {
      query: {
        orderBy: [{ type: "asc" }, { name: "asc" }],
      },
    }),
    dlcCount: t.relationCount("dlcs"),
    // Many-to-many: games instead of game
    games: t.relation("games", {
      query: {
        orderBy: { title: "asc" },
      },
    }),
    gameCount: t.relationCount("games"),
    // Convenience field: array of game IDs
    gameIds: t.stringList({
      resolve: async (version, _args, ctx) => {
        const games = await ctx.prisma.game.findMany({
          where: { versions: { some: { id: version.id } } },
          select: { id: true },
        });
        return games.map(g => g.id);
      },
    }),
    achievementSets: t.relation("achievementSets", {
      query: {
        orderBy: { title: "asc" },
      },
    }),
    achievementSetCount: t.relationCount("achievementSets"),
    // Computed field: returns version coverUrl if set, otherwise falls back to first game's coverUrl
    effectiveCoverUrl: t.string({
      nullable: true,
      resolve: async (version, _args, ctx) => {
        if (version.coverUrl) {
          return version.coverUrl;
        }
        const firstGame = await ctx.prisma.game.findFirst({
          where: { versions: { some: { id: version.id } } },
          select: { coverUrl: true },
        });
        return firstGame?.coverUrl ?? null;
      },
    }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

// Input types for game version mutations
export const CreateGameVersionInput = builder.inputType("CreateGameVersionInput", {
  fields: (t) => ({
    gameIds: t.idList({ required: true }), // Now accepts array of game IDs
    name: t.string({ required: true }),
    slug: t.string({ required: true }),
    description: t.string(),
    coverUrl: t.string(),
    releaseDate: t.field({ type: "DateTime" }),
    dlcIds: t.idList(),
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
    dlcIds: t.idList(),
    gameIds: t.idList(), // Optional: update linked games
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
