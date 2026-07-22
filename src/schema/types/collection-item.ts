import { GameRegion } from "@prisma/client";
import { builder } from "../builder.js";

// GameRegion enum for GraphQL
export const GameRegionEnum = builder.enumType(GameRegion, {
  name: "GameRegion",
});

builder.prismaObject("CollectionItem", {
  fields: (t) => ({
    id: t.exposeID("id"),
    user: t.relation("user"),
    userId: t.exposeString("userId"),
    game: t.relation("game", { nullable: true }),
    gameId: t.exposeString("gameId", { nullable: true }),
    bundle: t.relation("bundle", { nullable: true }),
    bundleId: t.exposeString("bundleId", { nullable: true }),
    platform: t.relation("platform", { nullable: true }),
    platformId: t.exposeString("platformId", { nullable: true }),
    gameVersion: t.relation("gameVersion", { nullable: true }),
    gameVersionId: t.exposeString("gameVersionId", { nullable: true }),
    hasDisc: t.exposeBoolean("hasDisc"),
    hasBox: t.exposeBoolean("hasBox"),
    hasManual: t.exposeBoolean("hasManual"),
    hasExtras: t.exposeBoolean("hasExtras"),
    isDigital: t.exposeBoolean("isDigital"),
    isSealed: t.exposeBoolean("isSealed"),
    region: t.expose("region", { type: GameRegionEnum }),
    notes: t.exposeString("notes", { nullable: true }),
    purchasePrice: t.exposeFloat("purchasePrice", { nullable: true }),
    purchasedAt: t.expose("purchasedAt", { type: "DateTime", nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});
