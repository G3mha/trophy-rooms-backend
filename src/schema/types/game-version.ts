import { builder, MutationErrorRef } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";

// Per-platform release date override for a shared version (e.g. Sifu
// Vengeance Edition shipped on PS5 months before Switch)
builder.prismaObject("GameVersionReleaseDate", {
  fields: (t) => ({
    gameId: t.exposeString("gameId"),
    gameVersionId: t.exposeString("gameVersionId"),
    releaseDate: t.expose("releaseDate", { type: "DateTime" }),
    game: t.relation("game"),
  }),
});

builder.prismaObject("GameVersion", {
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    slug: t.exposeString("slug"),
    description: t.exposeString("description", { nullable: true }),
    coverUrl: t.exposeString("coverUrl", { nullable: true }),
    releaseDate: t.expose("releaseDate", { type: "DateTime", nullable: true }),
    isDefault: t.exposeBoolean("isDefault"),
    digitalOnly: t.exposeBoolean("digitalOnly"),
    dlcs: t.prismaField({
      type: ["DLC"],
      resolve: async (query, version, _args, ctx) => {
        return ctx.prisma.dLC.findMany({
          ...query,
          where: { gameVersions: { some: { id: version.id } } },
          orderBy: [{ type: "asc" }, { name: "asc" }],
        });
      },
    }),
    dlcCount: t.int({
      resolve: async (version, _args, ctx) => {
        return ctx.prisma.dLC.count({
          where: { gameVersions: { some: { id: version.id } } },
        });
      },
    }),
    // Many-to-many: games instead of game
    games: t.prismaField({
      type: ["Game"],
      resolve: async (query, version, _args, ctx) => {
        return ctx.prisma.game.findMany({
          ...query,
          where: { versions: { some: { id: version.id } } },
          orderBy: { gameFamily: { title: "asc" } },
        });
      },
    }),
    gameCount: t.int({
      resolve: async (version, _args, ctx) => {
        return ctx.prisma.game.count({
          where: { versions: { some: { id: version.id } } },
        });
      },
    }),
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
    versionReleaseDates: t.relation("versionReleaseDates"),
    // Computed field: the release date of this version for a specific game
    // (platform), falling back to the version's canonical releaseDate
    releaseDateFor: t.field({
      type: "DateTime",
      nullable: true,
      args: {
        gameId: t.arg.id({ required: true }),
      },
      resolve: async (version, args, ctx) => {
        const override = await ctx.prisma.gameVersionReleaseDate.findUnique({
          where: {
            gameId_gameVersionId: {
              gameId: String(args.gameId),
              gameVersionId: version.id,
            },
          },
        });
        return override?.releaseDate ?? version.releaseDate ?? null;
      },
    }),
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
    digitalOnly: t.boolean(),
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
    digitalOnly: t.boolean(),
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
      resolve: async (_query, result, _args, ctx) => {
        if (!result.gameVersionId) return null;
        return ctx.prisma.gameVersion.findUnique({
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
