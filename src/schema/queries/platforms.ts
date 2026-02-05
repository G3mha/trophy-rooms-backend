import { builder } from "../builder.js";

builder.queryField("platforms", (t) =>
  t.prismaField({
    type: ["Platform"],
    resolve: async (query, _root, _args, ctx) => {
      return ctx.prisma.platform.findMany({
        ...query,
        orderBy: { name: "asc" },
      });
    },
  })
);
