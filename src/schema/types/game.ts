import { builder, MutationErrorRef } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";
import { visibleSetWhere } from "../../lib/achievement-visibility.js";

// GameType enum for categorizing games (base games, fangames, ROM hacks, mods, DLCs, expansions)
export const GameTypeEnum = builder.enumType("GameType", {
  values: ["BASE_GAME", "FANGAME", "ROM_HACK", "MOD", "DLC", "EXPANSION"] as const,
});

builder.prismaObject("Game", {
  fields: (t) => ({
    id: t.exposeID("id"),

    // Link to GameFamily
    gameFamily: t.relation("gameFamily", { nullable: true }),
    gameFamilyId: t.exposeString("gameFamilyId", { nullable: true }),

    // Delegated fields from GameFamily (with platform override for coverUrl).
    // Each one selects what it needs from the family, and Pothos merges those
    // selections into the query that loads the game, so a game page reads its
    // family once rather than once per field.
    title: t.string({
      select: { gameFamily: { select: { title: true } } },
      resolve: (game) => game.gameFamily?.title ?? "Unknown",
    }),
    // Platform-specific description override, falls back to family description
    description: t.string({
      nullable: true,
      select: { gameFamily: { select: { description: true } } },
      resolve: (game) => {
        if (game.description) return game.description;
        return game.gameFamily?.description ?? null;
      },
    }),
    // Platform-specific coverUrl override, falls back to family coverUrl
    coverUrl: t.string({
      nullable: true,
      select: { gameFamily: { select: { coverUrl: true } } },
      resolve: (game) => {
        if (game.coverUrl) return game.coverUrl;
        return game.gameFamily?.coverUrl ?? null;
      },
    }),
    releaseDate: t.expose("releaseDate", { type: "DateTime", nullable: true }),
    // Raw per-platform override values (no family fallback) for admin editing
    platformCoverUrl: t.exposeString("coverUrl", { nullable: true }),
    platformDescription: t.exposeString("description", { nullable: true }),
    developer: t.string({
      nullable: true,
      select: { gameFamily: { select: { developer: true } } },
      resolve: (game) => game.gameFamily?.developer ?? null,
    }),
    publisher: t.string({
      nullable: true,
      select: { gameFamily: { select: { publisher: true } } },
      resolve: (game) => game.gameFamily?.publisher ?? null,
    }),
    genre: t.string({
      nullable: true,
      select: { gameFamily: { select: { genre: true } } },
      resolve: (game) => game.gameFamily?.genre ?? null,
    }),
    esrbRating: t.string({
      nullable: true,
      select: { gameFamily: { select: { esrbRating: true } } },
      resolve: (game) => game.gameFamily?.esrbRating ?? null,
    }),
    screenshots: t.stringList({
      select: { gameFamily: { select: { screenshots: true } } },
      resolve: (game) => game.gameFamily?.screenshots ?? [],
    }),
    type: t.field({
      type: GameTypeEnum,
      select: { gameFamily: { select: { type: true } } },
      resolve: (game) => game.gameFamily?.type ?? "BASE_GAME",
    }),

    // Base game families of this game's family (fangames, ROM hacks, mods):
    // the families that list this family among their derived ones
    baseGameFamilies: t.prismaField({
      type: ["GameFamily"],
      resolve: async (query, game, _args, ctx) => {
        if (!game.gameFamilyId) return [];
        return ctx.prisma.gameFamily.findMany({
          ...query,
          where: { derivedGameFamilies: { some: { id: game.gameFamilyId } } },
        });
      },
    }),

    // Derived game families of this game's family (fangames, ROM hacks, mods)
    derivedGameFamilies: t.prismaField({
      type: ["GameFamily"],
      resolve: async (query, game, _args, ctx) => {
        if (!game.gameFamilyId) return [];
        return ctx.prisma.gameFamily.findMany({
          ...query,
          where: { baseGameFamilies: { some: { id: game.gameFamilyId } } },
        });
      },
    }),
    derivedGameFamilyCount: t.int({
      select: { gameFamily: { select: { _count: { select: { derivedGameFamilies: true } } } } },
      resolve: (game) => game.gameFamily?._count.derivedGameFamilies ?? 0,
    }),

    // Base games via family
    baseGames: t.prismaField({
      type: ["Game"],
      resolve: async (query, game, _args, ctx) => {
        if (!game.gameFamilyId) return [];
        return ctx.prisma.game.findMany({
          ...query,
          where: { gameFamily: { derivedGameFamilies: { some: { id: game.gameFamilyId } } } },
        });
      },
    }),
    baseGameCount: t.int({
      select: { gameFamily: { select: { _count: { select: { baseGameFamilies: true } } } } },
      resolve: (game) => game.gameFamily?._count.baseGameFamilies ?? 0,
    }),

    // Derived games via family
    derivedGames: t.prismaField({
      type: ["Game"],
      resolve: async (query, game, _args, ctx) => {
        if (!game.gameFamilyId) return [];
        return ctx.prisma.game.findMany({
          ...query,
          where: { gameFamily: { baseGameFamilies: { some: { id: game.gameFamilyId } } } },
        });
      },
    }),
    derivedGameCount: t.int({
      select: { gameFamily: { select: { _count: { select: { derivedGameFamilies: true } } } } },
      resolve: (game) => game.gameFamily?._count.derivedGameFamilies ?? 0,
    }),

    platform: t.prismaField({
      type: "Platform",
      nullable: true,
      resolve: async (query, game, _args, ctx) => {
        if (!game.platformId) return null;
        return ctx.prisma.platform.findUnique({
          ...query,
          where: { id: game.platformId },
        });
      },
    }),
    platformId: t.exposeString("platformId", { nullable: true }),

    // Achievement sets now come from the family
    achievementSets: t.prismaField({
      type: ["AchievementSet"],
      resolve: async (query, game, _args, ctx) => {
        if (!game.gameFamilyId) return [];
        return ctx.prisma.achievementSet.findMany({
          ...query,
          where: {
            gameFamilyId: game.gameFamilyId,
            AND: [visibleSetWhere(ctx.user)],
          },
          orderBy: { title: "asc" },
        });
      },
    }),

    trophies: t.relation("trophies", {
      query: {
        orderBy: { createdAt: "desc" },
      },
    }),
    versions: t.prismaField({
      type: ["GameVersion"],
      resolve: async (query, game, _args, ctx) => {
        return ctx.prisma.gameVersion.findMany({
          ...query,
          where: { games: { some: { id: game.id } } },
          orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        });
      },
    }),
    versionCount: t.int({
      resolve: async (game, _args, ctx) => {
        return ctx.prisma.gameVersion.count({
          where: { games: { some: { id: game.id } } },
        });
      },
    }),

    // DLCs now come from the family
    dlcs: t.prismaField({
      type: ["DLC"],
      resolve: async (query, game, _args, ctx) => {
        if (!game.gameFamilyId) return [];
        return ctx.prisma.dLC.findMany({
          ...query,
          where: { gameFamilyId: game.gameFamilyId },
          orderBy: [{ type: "asc" }, { name: "asc" }],
        });
      },
    }),
    dlcCount: t.int({
      resolve: async (game, _args, ctx) => {
        if (!game.gameFamilyId) return 0;
        return ctx.prisma.dLC.count({
          where: { gameFamilyId: game.gameFamilyId },
        });
      },
    }),

    // Bundles now come from the family
    bundles: t.prismaField({
      type: ["Bundle"],
      resolve: async (query, game, _args, ctx) => {
        if (!game.gameFamilyId) return [];
        return ctx.prisma.bundle.findMany({
          ...query,
          where: { gameFamilies: { some: { id: game.gameFamilyId } } },
          orderBy: { name: "asc" },
        });
      },
    }),

    defaultVersion: t.prismaField({
      type: "GameVersion",
      nullable: true,
      resolve: async (query, game, _args, ctx) => {
        return ctx.prisma.gameVersion.findFirst({
          ...query,
          where: { games: { some: { id: game.id } }, isDefault: true },
        });
      },
    }),

    // Achievement set count from family
    achievementSetCount: t.int({
      resolve: async (game, _args, ctx) => {
        if (!game.gameFamilyId) return 0;
        return ctx.prisma.achievementSet.count({
          where: {
            gameFamilyId: game.gameFamilyId,
            AND: [visibleSetWhere(ctx.user)],
          },
        });
      },
    }),
    achievementCount: t.int({
      resolve: async (game, _args, ctx) => {
        if (!game.gameFamilyId) return 0;
        return ctx.prisma.achievement.count({
          where: {
            achievementSet: {
              gameFamilyId: game.gameFamilyId,
              AND: [visibleSetWhere(ctx.user)],
            },
          },
        });
      },
    }),
    trophyCount: t.int({
      resolve: async (game, _args, ctx) => {
        return ctx.prisma.trophy.count({
          where: { gameId: game.id },
        });
      },
    }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

// Input types for game mutations
// CreateGameInput creates both a GameFamily and a Game (platform instance)
export const CreateGameInput = builder.inputType("CreateGameInput", {
  fields: (t) => ({
    // GameFamily fields
    title: t.string({ required: true }),
    description: t.string(),
    coverUrl: t.string(),
    releaseDate: t.field({ type: "DateTime" }),
    developer: t.string(),
    publisher: t.string(),
    genre: t.string(),
    esrbRating: t.string(),
    screenshots: t.stringList(),
    type: t.field({ type: GameTypeEnum }),
    baseGameFamilyIds: t.idList(),
    // Game (platform instance) fields
    platformId: t.id(),
    platformReleaseDate: t.field({ type: "DateTime" }),
    platformCoverUrl: t.string(),
    platformDescription: t.string(),
  }),
});

// UpdateGameInput updates the Game's associated GameFamily
export const UpdateGameInput = builder.inputType("UpdateGameInput", {
  fields: (t) => ({
    // GameFamily fields (updates the family)
    title: t.string(),
    description: t.string(),
    coverUrl: t.string(),
    releaseDate: t.field({ type: "DateTime" }),
    developer: t.string(),
    publisher: t.string(),
    genre: t.string(),
    esrbRating: t.string(),
    screenshots: t.stringList(),
    type: t.field({ type: GameTypeEnum }),
    baseGameFamilyIds: t.idList(),
    // Game (platform instance) fields
    platformId: t.id(),
    platformReleaseDate: t.field({ type: "DateTime" }),
    platformCoverUrl: t.string(),
    platformDescription: t.string(),
  }),
});

// Input for adding a platform to an existing GameFamily
export const AddPlatformToGameFamilyInput = builder.inputType("AddPlatformToGameFamilyInput", {
  fields: (t) => ({
    gameFamilyId: t.id({ required: true }),
    platformId: t.id({ required: true }),
    releaseDate: t.field({ type: "DateTime" }),
    coverUrl: t.string(),
  }),
});

// Filter input for games query
export const GamesFilterInput = builder.inputType("GamesFilterInput", {
  fields: (t) => ({
    search: t.string(),
    hasAchievements: t.boolean(),
    platformId: t.id(),
    type: t.field({ type: GameTypeEnum }),
    isDerivative: t.boolean(), // true = has baseGames, false = no baseGames
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
