import { GameStatus } from "@prisma/client";
import { builder } from "../builder.js";

// GameStatus enum for GraphQL
export const GameStatusEnum = builder.enumType(GameStatus, {
  name: "GameStatus",
});

builder.prismaObject("UserGame", {
  fields: (t) => ({
    id: t.exposeID("id"),
    user: t.relation("user"),
    userId: t.exposeString("userId"),
    game: t.relation("game"),
    gameId: t.exposeString("gameId"),
    status: t.expose("status", { type: GameStatusEnum }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});
