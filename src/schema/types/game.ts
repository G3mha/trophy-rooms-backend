import { builder, MutationErrorRef } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";

// GameType enum for categorizing games (base games, fangames, ROM hacks, DLCs, expansions)
export const GameTypeEnum = builder.enumType("GameType", {
  values: ["BASE_GAME", "FANGAME", "ROM_HACK", "DLC", "EXPANSION"] as const,
});

builder.prismaObject("Game", {
  fields: (t) => ({
    id: t.exposeID("id"),
    title: t.exposeString("title"),
    description: t.exposeString("description", { nullable: true }),
    coverUrl: t.exposeString("coverUrl", { nullable: true }),
    releaseDate: t.expose("releaseDate", { type: "DateTime", nullable: true }),
    developer: t.exposeString("developer", { nullable: true }),
    publisher: t.exposeString("publisher", { nullable: true }),
    genre: t.exposeString("genre", { nullable: true }),
    esrbRating: t.exposeString("esrbRating", { nullable: true }),
    screenshots: t.exposeStringList("screenshots"),
    type: t.expose("type", { type: GameTypeEnum }),
    baseGameId: t.exposeString("baseGameId", { nullable: true }),
    baseGame: t.relation("baseGame", { nullable: true }),
    derivatives: t.relation("derivatives", {
      query: {
        orderBy: { title: "asc" },
      },
    }),
    derivativeCount: t.relationCount("derivatives"),
    platform: t.relation("platform", { nullable: true }),
    platformId: t.exposeString("platformId", { nullable: true }),
    achievementSets: t.relation("achievementSets", {
      query: {
        orderBy: { title: "asc" },
      },
    }),
    trophies: t.relation("trophies", {
      query: {
        orderBy: { createdAt: "desc" },
      },
    }),
    versions: t.relation("versions", {
      query: {
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      },
    }),
    versionCount: t.relationCount("versions"),
    dlcs: t.relation("dlcs", {
      query: {
        orderBy: [{ type: "asc" }, { name: "asc" }],
      },
    }),
    dlcCount: t.relationCount("dlcs"),
    bundles: t.relation("bundles", {
      query: {
        orderBy: { name: "asc" },
      },
    }),
    defaultVersion: t.prismaField({
      type: "GameVersion",
      nullable: true,
      resolve: async (query, game, _args, ctx) => {
        return ctx.prisma.gameVersion.findFirst({
          ...query,
          where: { gameId: game.id, isDefault: true },
        });
      },
    }),
    // Return 0 for now to avoid N+1 performance issues
    achievementSetCount: t.int({
      resolve: () => 0,
    }),
    achievementCount: t.int({
      resolve: () => 0,
    }),
    trophyCount: t.relationCount("trophies"),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

// Input types for game mutations
export const CreateGameInput = builder.inputType("CreateGameInput", {
  fields: (t) => ({
    title: t.string({ required: true }),
    description: t.string(),
    coverUrl: t.string(),
    releaseDate: t.field({ type: "DateTime" }),
    developer: t.string(),
    publisher: t.string(),
    genre: t.string(),
    esrbRating: t.string(),
    screenshots: t.stringList(),
    platformId: t.id(),
    type: t.field({ type: GameTypeEnum }),
    baseGameId: t.id(),
  }),
});

export const UpdateGameInput = builder.inputType("UpdateGameInput", {
  fields: (t) => ({
    title: t.string(),
    description: t.string(),
    coverUrl: t.string(),
    releaseDate: t.field({ type: "DateTime" }),
    developer: t.string(),
    publisher: t.string(),
    genre: t.string(),
    esrbRating: t.string(),
    screenshots: t.stringList(),
    platformId: t.id(),
    type: t.field({ type: GameTypeEnum }),
    baseGameId: t.id(),
  }),
});

// Filter input for games query
export const GamesFilterInput = builder.inputType("GamesFilterInput", {
  fields: (t) => ({
    search: t.string(),
    hasAchievements: t.boolean(),
    platformId: t.id(),
    type: t.field({ type: GameTypeEnum }),
    isDerivative: t.boolean(), // true = has baseGameId, false = no baseGameId
  }),
});

// Order by enum for games
export const GameOrderBy = builder.enumType("GameOrderBy", {
  values: [
    "TITLE_ASC",
    "TITLE_DESC",
    "CREATED_AT_ASC",
    "CREATED_AT_DESC",
    "ACHIEVEMENT_COUNT_DESC",
    "TROPHY_COUNT_DESC",
  ] as const,
});

// Game mutation result type
export const GameMutationResult = builder.objectRef<{
  success: boolean;
  gameId: string | null;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("GameMutationResult");

GameMutationResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    game: t.prismaField({
      type: "Game",
      nullable: true,
      resolve: async (query, result, _args, ctx) => {
        if (!result.gameId) return null;
        return ctx.prisma.game.findUnique({
          ...query,
          where: { id: result.gameId },
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
export const DeleteGameResult = builder.objectRef<{
  success: boolean;
  deletedId: string | null;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("DeleteGameResult");

DeleteGameResult.implement({
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
