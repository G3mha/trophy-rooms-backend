import { builder } from "../builder.js";

builder.prismaObject("PlaySession", {
  fields: (t) => ({
    id: t.exposeID("id"),
    game: t.relation("game"),
    gameId: t.exposeString("gameId"),
    playedOn: t.expose("playedOn", { type: "DateTime" }),
    minutes: t.exposeInt("minutes"),
    notes: t.exposeString("notes", { nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});
