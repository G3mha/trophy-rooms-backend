import { builder, MutationErrorRef } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";
import { GameTypeEnum } from "./game.js";

// GameFamily Prisma Object
builder.prismaObject("GameFamily", {
  fields: (t) => ({
    id: t.exposeID("id"),
    title: t.exposeString("title"),
    slug: t.exposeString("slug"),
    description: t.exposeString("description", { nullable: true }),
    coverUrl: t.exposeString("coverUrl", { nullable: true }),
    developer: t.exposeString("developer", { nullable: true }),
    publisher: t.exposeString("publisher", { nullable: true }),
    genre: t.exposeString("genre", { nullable: true }),
    esrbRating: t.exposeString("esrbRating", { nullable: true }),
    screenshots: t.exposeStringList("screenshots"),
    releaseDate: t.expose("releaseDate", { type: "DateTime", nullable: true }),
    type: t.expose("type", { type: GameTypeEnum }),

    // Relations
    games: t.relation("games", {
      query: {
        orderBy: { platform: { name: "asc" } },
      },
    }),
    gameCount: t.relationCount("games"),

    // Computed field: platforms this game is available on
    platforms: t.prismaField({
      type: ["Platform"],
      resolve: async (query, family, _args, ctx) => {
        const games = await ctx.prisma.game.findMany({
          where: { gameFamilyId: family.id, platformId: { not: null } },
          select: { platformId: true },
          distinct: ["platformId"],
        });
        const platformIds = games
          .map((g) => g.platformId)
          .filter((id): id is string => id !== null);
        if (platformIds.length === 0) return [];
        return ctx.prisma.platform.findMany({
          ...query,
          where: { id: { in: platformIds } },
          orderBy: { name: "asc" },
        });
      },
    }),

    achievementSets: t.relation("achievementSets", {
      query: {
        orderBy: { title: "asc" },
      },
    }),
    achievementSetCount: t.relationCount("achievementSets"),

    // Computed field: total achievement count across all sets
    totalAchievementCount: t.int({
      resolve: async (family, _args, ctx) => {
        const result = await ctx.prisma.achievement.count({
          where: { achievementSet: { gameFamilyId: family.id } },
        });
        return result;
      },
    }),

    // Computed field: total trophy count across all platform games
    totalTrophyCount: t.int({
      resolve: async (family, _args, ctx) => {
        const result = await ctx.prisma.trophy.count({
          where: { game: { gameFamilyId: family.id } },
        });
        return result;
      },
    }),

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

    // Self-referencing relations for derivatives
    baseGameFamilies: t.relation("baseGameFamilies", {
      query: {
        orderBy: { title: "asc" },
      },
    }),
    baseGameFamilyCount: t.relationCount("baseGameFamilies"),

    derivedGameFamilies: t.relation("derivedGameFamilies", {
      query: {
        where: { type: { in: ["FANGAME", "ROM_HACK", "MOD", "DLC", "EXPANSION"] } },
        orderBy: { title: "asc" },
      },
    }),
    derivedGameFamilyCount: t.relationCount("derivedGameFamilies", {
      where: { type: { in: ["FANGAME", "ROM_HACK", "MOD", "DLC", "EXPANSION"] } },
    }),

    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

// Input types for GameFamily mutations
export const CreateGameFamilyInput = builder.inputType("CreateGameFamilyInput", {
  fields: (t) => ({
    title: t.string({ required: true }),
    slug: t.string(),
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
    // Optional: create initial platform games
    platformIds: t.idList(),
  }),
});

export const UpdateGameFamilyInput = builder.inputType("UpdateGameFamilyInput", {
  fields: (t) => ({
    title: t.string(),
    slug: t.string(),
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
  }),
});

// Filter input for game families query
export const GameFamiliesFilterInput = builder.inputType("GameFamiliesFilterInput", {
  fields: (t) => ({
    search: t.string(),
    hasAchievements: t.boolean(),
    platformId: t.id(),
    type: t.field({ type: GameTypeEnum }),
    isDerivative: t.boolean(),
  }),
});

// Order by enum for game families
export const GameFamilyOrderBy = builder.enumType("GameFamilyOrderBy", {
  values: [
    "TITLE_ASC",
    "TITLE_DESC",
    "CREATED_AT_ASC",
    "CREATED_AT_DESC",
    "ACHIEVEMENT_COUNT_DESC",
    "TROPHY_COUNT_DESC",
    "PLATFORM_COUNT_DESC",
  ] as const,
});

// GameFamily mutation result type
export const GameFamilyMutationResult = builder.objectRef<{
  success: boolean;
  gameFamilyId: string | null;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("GameFamilyMutationResult");

GameFamilyMutationResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    gameFamilyId: t.exposeString("gameFamilyId", { nullable: true }),
    gameFamily: t.prismaField({
      type: "GameFamily",
      nullable: true,
      resolve: async (query, result, _args, ctx) => {
        if (!result.gameFamilyId) return null;
        return ctx.prisma.gameFamily.findUnique({
          ...query,
          where: { id: result.gameFamilyId },
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

// Delete GameFamily result type
export const DeleteGameFamilyResult = builder.objectRef<{
  success: boolean;
  deletedId: string | null;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("DeleteGameFamilyResult");

DeleteGameFamilyResult.implement({
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
