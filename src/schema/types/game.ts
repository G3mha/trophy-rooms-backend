import { builder, MutationErrorRef } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";

builder.prismaObject("Game", {
  fields: (t) => ({
    id: t.exposeID("id"),
    title: t.exposeString("title"),
    description: t.exposeString("description", { nullable: true }),
    coverUrl: t.exposeString("coverUrl", { nullable: true }),
    platform: t.relation("platform", { nullable: true }),
    platformId: t.exposeString("platformId", { nullable: true }),
    achievementSets: t.prismaField({
      type: ["AchievementSet"],
      resolve: async (query, game, _args, ctx) => {
        try {
          return await ctx.prisma.achievementSet.findMany({
            ...query,
            where: { gameId: game.id },
            orderBy: { title: "asc" },
          });
        } catch (error) {
          console.error("achievementSets error for game:", game.id, error);
          return []; // Return empty array on error
        }
      },
    }),
    trophies: t.relation("trophies", {
      query: {
        orderBy: { createdAt: "desc" },
      },
    }),
    // Use relationCount for better performance (avoids N+1)
    achievementSetCount: t.relationCount("achievementSets"),
    // For achievementCount, we still need a resolver since it's a nested count
    achievementCount: t.int({
      resolve: async (game, _args, ctx) => {
        try {
          const count = await ctx.prisma.achievement.count({
            where: {
              achievementSet: { gameId: game.id },
            },
          });
          return count;
        } catch (error) {
          console.error("achievementCount error for game:", game.id, error);
          return 0;
        }
      },
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
    platformId: t.id(),
  }),
});

export const UpdateGameInput = builder.inputType("UpdateGameInput", {
  fields: (t) => ({
    title: t.string(),
    description: t.string(),
    coverUrl: t.string(),
    platformId: t.id(),
  }),
});

// Filter input for games query
export const GamesFilterInput = builder.inputType("GamesFilterInput", {
  fields: (t) => ({
    search: t.string(),
    hasAchievements: t.boolean(),
    platformId: t.id(),
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
