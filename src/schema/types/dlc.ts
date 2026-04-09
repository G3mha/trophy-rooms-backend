import { builder, MutationErrorRef } from "../builder.js";
import { DLCType } from "@prisma/client";
import { ErrorCode } from "../../lib/errors.js";

// Register the DLCType enum
builder.enumType(DLCType, {
  name: "DLCType",
});

builder.prismaObject("DLC", {
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    slug: t.exposeString("slug"),
    type: t.expose("type", { type: DLCType }),
    description: t.exposeString("description", { nullable: true }),
    coverUrl: t.exposeString("coverUrl", { nullable: true }),
    releaseDate: t.expose("releaseDate", { type: "DateTime", nullable: true }),
    price: t.exposeFloat("price", { nullable: true }),
    game: t.relation("game"),
    gameId: t.exposeString("gameId"),
    achievementSets: t.relation("achievementSets", {
      query: {
        orderBy: { title: "asc" },
      },
    }),
    achievementSetCount: t.relationCount("achievementSets"),
    gameVersions: t.relation("gameVersions", {
      query: {
        orderBy: { name: "asc" },
      },
    }),
    bundles: t.relation("bundles", {
      query: {
        orderBy: { name: "asc" },
      },
    }),
    // Computed field: returns DLC coverUrl if set, otherwise falls back to game.coverUrl
    effectiveCoverUrl: t.string({
      nullable: true,
      resolve: async (dlc, _args, ctx) => {
        if (dlc.coverUrl) {
          return dlc.coverUrl;
        }
        const game = await ctx.prisma.game.findUnique({
          where: { id: dlc.gameId },
          select: { coverUrl: true },
        });
        return game?.coverUrl ?? null;
      },
    }),
    // Check if the current user owns this DLC
    isOwned: t.boolean({
      resolve: async (dlc, _args, ctx) => {
        if (!ctx.user) return false;
        const userDlc = await ctx.prisma.userDLC.findUnique({
          where: {
            userId_dlcId: {
              userId: ctx.user.id,
              dlcId: dlc.id,
            },
          },
        });
        return !!userDlc;
      },
    }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

// UserDLC type
builder.prismaObject("UserDLC", {
  fields: (t) => ({
    id: t.exposeID("id"),
    user: t.relation("user"),
    userId: t.exposeString("userId"),
    dlc: t.relation("dlc"),
    dlcId: t.exposeString("dlcId"),
    purchasePrice: t.exposeFloat("purchasePrice", { nullable: true }),
    purchasedAt: t.expose("purchasedAt", { type: "DateTime", nullable: true }),
    ownedAt: t.expose("ownedAt", { type: "DateTime" }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

// Input types for DLC mutations
export const CreateDLCInput = builder.inputType("CreateDLCInput", {
  fields: (t) => ({
    gameId: t.id({ required: true }),
    name: t.string({ required: true }),
    slug: t.string({ required: true }),
    type: t.field({ type: DLCType }),
    description: t.string(),
    coverUrl: t.string(),
    releaseDate: t.field({ type: "DateTime" }),
    price: t.float(),
  }),
});

export const UpdateDLCInput = builder.inputType("UpdateDLCInput", {
  fields: (t) => ({
    name: t.string(),
    slug: t.string(),
    type: t.field({ type: DLCType }),
    description: t.string(),
    coverUrl: t.string(),
    releaseDate: t.field({ type: "DateTime" }),
    price: t.float(),
  }),
});

// DLC mutation result type
export const DLCMutationResult = builder.objectRef<{
  success: boolean;
  dlcId: string | null;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("DLCMutationResult");

DLCMutationResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    dlc: t.prismaField({
      type: "DLC",
      nullable: true,
      resolve: async (query, result, _args, ctx) => {
        if (!result.dlcId) return null;
        return ctx.prisma.dLC.findUnique({
          ...query,
          where: { id: result.dlcId },
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

// Delete DLC result type
export const DeleteDLCResult = builder.objectRef<{
  success: boolean;
  deletedId: string | null;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("DeleteDLCResult");

DeleteDLCResult.implement({
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

// UserDLC mutation result type
export const UserDLCMutationResult = builder.objectRef<{
  success: boolean;
  userDlcId: string | null;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("UserDLCMutationResult");

UserDLCMutationResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    userDlc: t.prismaField({
      type: "UserDLC",
      nullable: true,
      resolve: async (query, result, _args, ctx) => {
        if (!result.userDlcId) return null;
        return ctx.prisma.userDLC.findUnique({
          ...query,
          where: { id: result.userDlcId },
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
