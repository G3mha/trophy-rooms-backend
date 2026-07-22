import { builder, MutationErrorRef } from "../builder.js";
import { BundleType as PrismaBundleType } from "@prisma/client";
import { ErrorCode } from "../../lib/errors.js";

// Register the BundleType enum and export the reference
export const BundleType = builder.enumType(PrismaBundleType, {
  name: "BundleType",
});

builder.prismaObject("Bundle", {
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    slug: t.exposeString("slug"),
    type: t.expose("type", { type: PrismaBundleType }),
    description: t.exposeString("description", { nullable: true }),
    coverUrl: t.exposeString("coverUrl", { nullable: true }),
    releaseDate: t.expose("releaseDate", { type: "DateTime", nullable: true }),
    price: t.exposeFloat("price", { nullable: true }),

    // Platforms this bundle is available on (many-to-many)
    platforms: t.relation("platforms"),
    platformCount: t.relationCount("platforms"),

    // Game families in this bundle
    gameFamilies: t.relation("gameFamilies", {
      query: {
        orderBy: { title: "asc" },
      },
    }),
    gameFamilyCount: t.relationCount("gameFamilies"),

    dlcs: t.relation("dlcs", {
      query: {
        orderBy: { name: "asc" },
      },
    }),
    dlcCount: t.relationCount("dlcs"),
    // Check if the current user owns this Bundle (on any platform)
    isOwned: t.boolean({
      resolve: async (bundle, _args, ctx) => {
        if (!ctx.user) return false;
        const item = await ctx.prisma.collectionItem.findFirst({
          where: {
            userId: ctx.user.id,
            bundleId: bundle.id,
          },
        });
        return !!item;
      },
    }),
    // Get all platforms the user owns this bundle on
    ownedPlatforms: t.prismaField({
      type: ["Platform"],
      resolve: async (query, bundle, _args, ctx) => {
        if (!ctx.user) return [];
        const items = await ctx.prisma.collectionItem.findMany({
          where: {
            userId: ctx.user.id,
            bundleId: bundle.id,
            platformId: { not: null },
          },
          select: {
            platformId: true,
          },
        });
        const platformIds = items
          .map((item) => item.platformId)
          .filter((id): id is string => id !== null);
        if (platformIds.length === 0) return [];
        return ctx.prisma.platform.findMany({
          ...query,
          where: { id: { in: platformIds } },
        });
      },
    }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

// UserBundle type
builder.prismaObject("UserBundle", {
  fields: (t) => ({
    id: t.exposeID("id"),
    user: t.relation("user"),
    userId: t.exposeString("userId"),
    bundle: t.relation("bundle"),
    bundleId: t.exposeString("bundleId"),
    platform: t.relation("platform", { nullable: true }),
    platformId: t.exposeString("platformId", { nullable: true }),
    purchasePrice: t.exposeFloat("purchasePrice", { nullable: true }),
    purchasedAt: t.expose("purchasedAt", { type: "DateTime", nullable: true }),
    ownedAt: t.expose("ownedAt", { type: "DateTime" }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

// Input types for Bundle mutations
export const CreateBundleInput = builder.inputType("CreateBundleInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    slug: t.string({ required: true }),
    type: t.field({ type: BundleType }),
    description: t.string(),
    coverUrl: t.string(),
    releaseDate: t.field({ type: "DateTime" }),
    price: t.float(),
    platformIds: t.idList(),
    gameFamilyIds: t.idList(),
    dlcIds: t.idList(),
  }),
});

export const UpdateBundleInput = builder.inputType("UpdateBundleInput", {
  fields: (t) => ({
    name: t.string(),
    slug: t.string(),
    type: t.field({ type: BundleType }),
    description: t.string(),
    coverUrl: t.string(),
    releaseDate: t.field({ type: "DateTime" }),
    price: t.float(),
    platformIds: t.idList(),
    gameFamilyIds: t.idList(),
    dlcIds: t.idList(),
  }),
});

// Bundle mutation result type
export const BundleMutationResult = builder.objectRef<{
  success: boolean;
  bundleId: string | null;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("BundleMutationResult");

BundleMutationResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    bundle: t.prismaField({
      type: "Bundle",
      nullable: true,
      resolve: async (query, result, _args, ctx) => {
        if (!result.bundleId) return null;
        return ctx.prisma.bundle.findUnique({
          ...query,
          where: { id: result.bundleId },
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

// Delete Bundle result type
export const DeleteBundleResult = builder.objectRef<{
  success: boolean;
  deletedId: string | null;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("DeleteBundleResult");

DeleteBundleResult.implement({
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

// UserBundle mutation result type
export const UserBundleMutationResult = builder.objectRef<{
  success: boolean;
  userBundleId: string | null;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("UserBundleMutationResult");

UserBundleMutationResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    // Bundle ownership lives in CollectionItem; userBundleId carries its id
    collectionItem: t.prismaField({
      type: "CollectionItem",
      nullable: true,
      resolve: async (query, result, _args, ctx) => {
        if (!result.userBundleId) return null;
        return ctx.prisma.collectionItem.findUnique({
          ...query,
          where: { id: result.userBundleId },
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
