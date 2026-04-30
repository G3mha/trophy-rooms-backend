import { builder, MutationErrorRef } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";

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

    // Delegated fields from GameFamily (with platform override for coverUrl)
    title: t.string({
      resolve: async (game, _args, ctx) => {
        if (!game.gameFamilyId) return "Unknown";
        const family = await ctx.prisma.gameFamily.findUnique({
          where: { id: game.gameFamilyId },
          select: { title: true },
        });
        return family?.title ?? "Unknown";
      },
    }),
    description: t.string({
      nullable: true,
      resolve: async (game, _args, ctx) => {
        if (!game.gameFamilyId) return null;
        const family = await ctx.prisma.gameFamily.findUnique({
          where: { id: game.gameFamilyId },
          select: { description: true },
        });
        return family?.description ?? null;
      },
    }),
    // Platform-specific coverUrl override, falls back to family coverUrl
    coverUrl: t.string({
      nullable: true,
      resolve: async (game, _args, ctx) => {
        // Use platform-specific override if set
        if (game.coverUrl) return game.coverUrl;
        // Fall back to family coverUrl
        if (!game.gameFamilyId) return null;
        const family = await ctx.prisma.gameFamily.findUnique({
          where: { id: game.gameFamilyId },
          select: { coverUrl: true },
        });
        return family?.coverUrl ?? null;
      },
    }),
    releaseDate: t.expose("releaseDate", { type: "DateTime", nullable: true }),
    developer: t.string({
      nullable: true,
      resolve: async (game, _args, ctx) => {
        if (!game.gameFamilyId) return null;
        const family = await ctx.prisma.gameFamily.findUnique({
          where: { id: game.gameFamilyId },
          select: { developer: true },
        });
        return family?.developer ?? null;
      },
    }),
    publisher: t.string({
      nullable: true,
      resolve: async (game, _args, ctx) => {
        if (!game.gameFamilyId) return null;
        const family = await ctx.prisma.gameFamily.findUnique({
          where: { id: game.gameFamilyId },
          select: { publisher: true },
        });
        return family?.publisher ?? null;
      },
    }),
    genre: t.string({
      nullable: true,
      resolve: async (game, _args, ctx) => {
        if (!game.gameFamilyId) return null;
        const family = await ctx.prisma.gameFamily.findUnique({
          where: { id: game.gameFamilyId },
          select: { genre: true },
        });
        return family?.genre ?? null;
      },
    }),
    esrbRating: t.string({
      nullable: true,
      resolve: async (game, _args, ctx) => {
        if (!game.gameFamilyId) return null;
        const family = await ctx.prisma.gameFamily.findUnique({
          where: { id: game.gameFamilyId },
          select: { esrbRating: true },
        });
        return family?.esrbRating ?? null;
      },
    }),
    screenshots: t.stringList({
      resolve: async (game, _args, ctx) => {
        if (!game.gameFamilyId) return [];
        const family = await ctx.prisma.gameFamily.findUnique({
          where: { id: game.gameFamilyId },
          select: { screenshots: true },
        });
        return family?.screenshots ?? [];
      },
    }),
    type: t.field({
      type: GameTypeEnum,
      resolve: async (game, _args, ctx) => {
        if (!game.gameFamilyId) return "BASE_GAME";
        const family = await ctx.prisma.gameFamily.findUnique({
          where: { id: game.gameFamilyId },
          select: { type: true },
        });
        return family?.type ?? "BASE_GAME";
      },
    }),

    // Base games via family
    baseGames: t.prismaField({
      type: ["Game"],
      resolve: async (query, game, _args, ctx) => {
        if (!game.gameFamilyId) return [];
        const family = await ctx.prisma.gameFamily.findUnique({
          where: { id: game.gameFamilyId },
          include: { baseGameFamilies: { select: { id: true } } },
        });
        if (!family || family.baseGameFamilies.length === 0) return [];
        return ctx.prisma.game.findMany({
          ...query,
          where: {
            gameFamilyId: { in: family.baseGameFamilies.map((f) => f.id) },
          },
        });
      },
    }),
    baseGameCount: t.int({
      resolve: async (game, _args, ctx) => {
        if (!game.gameFamilyId) return 0;
        const family = await ctx.prisma.gameFamily.findUnique({
          where: { id: game.gameFamilyId },
          include: { _count: { select: { baseGameFamilies: true } } },
        });
        return family?._count.baseGameFamilies ?? 0;
      },
    }),

    // Derived games via family
    derivedGames: t.prismaField({
      type: ["Game"],
      resolve: async (query, game, _args, ctx) => {
        if (!game.gameFamilyId) return [];
        const family = await ctx.prisma.gameFamily.findUnique({
          where: { id: game.gameFamilyId },
          include: { derivedGameFamilies: { select: { id: true } } },
        });
        if (!family || family.derivedGameFamilies.length === 0) return [];
        return ctx.prisma.game.findMany({
          ...query,
          where: {
            gameFamilyId: { in: family.derivedGameFamilies.map((f) => f.id) },
          },
        });
      },
    }),
    derivedGameCount: t.int({
      resolve: async (game, _args, ctx) => {
        if (!game.gameFamilyId) return 0;
        const family = await ctx.prisma.gameFamily.findUnique({
          where: { id: game.gameFamilyId },
          include: { _count: { select: { derivedGameFamilies: true } } },
        });
        return family?._count.derivedGameFamilies ?? 0;
      },
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
          where: { gameFamilyId: game.gameFamilyId },
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
          where: { gameFamilyId: game.gameFamilyId },
        });
      },
    }),
    achievementCount: t.int({
      resolve: async (game, _args, ctx) => {
        if (!game.gameFamilyId) return 0;
        return ctx.prisma.achievement.count({
          where: { achievementSet: { gameFamilyId: game.gameFamilyId } },
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
      resolve: async (_query, result, _args, ctx) => {
        if (!result.gameId) return null;
        return ctx.prisma.game.findUnique({
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
