import { builder } from "../builder.js";

builder.prismaObject("Trophy", {
  fields: (t) => ({
    id: t.exposeID("id"),
    user: t.relation("user"),
    userId: t.exposeString("userId"),
    game: t.relation("game"),
    gameId: t.exposeString("gameId"),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
  }),
});
