import { Prisma } from "@prisma/client";
import { builder } from "../builder.js";
import { GamesFilterInput, GameOrderBy } from "../types/game.js";

// Games connection with cursor-based pagination
builder.queryField("games", (t) =>
  t.prismaConnection({
    type: "Game",
    cursor: "id",
    args: {
      filter: t.arg({ type: GamesFilterInput }),
      orderBy: t.arg({ type: GameOrderBy }),
    },
    totalCount: (_connection, _args, ctx) => ctx.prisma.game.count(),
    resolve: async (query, _root, args, ctx) => {
      const { filter, orderBy } = args;

      // Build where clause
      const where: Prisma.GameWhereInput = {};

      if (filter?.search) {
        where.OR = [
          { title: { contains: filter.search, mode: "insensitive" } },
          { description: { contains: filter.search, mode: "insensitive" } },
        ];
      }

      if (filter?.hasAchievements === true) {
        where.achievements = { some: {} };
      } else if (filter?.hasAchievements === false) {
        where.achievements = { none: {} };
      }

      // Build order by clause
      let orderByClause: Prisma.GameOrderByWithRelationInput;

      switch (orderBy) {
        case "TITLE_DESC":
          orderByClause = { title: "desc" };
          break;
        case "CREATED_AT_ASC":
          orderByClause = { createdAt: "asc" };
          break;
        case "CREATED_AT_DESC":
          orderByClause = { createdAt: "desc" };
          break;
        case "ACHIEVEMENT_COUNT_DESC":
          orderByClause = { achievements: { _count: "desc" } };
          break;
        case "TROPHY_COUNT_DESC":
          orderByClause = { trophies: { _count: "desc" } };
          break;
        case "TITLE_ASC":
        default:
          orderByClause = { title: "asc" };
          break;
      }

      return ctx.prisma.game.findMany({
        ...query,
        where,
        orderBy: orderByClause,
      });
    },
  })
);

// Single game query
builder.queryField("game", (t) =>
  t.prismaField({
    type: "Game",
    nullable: true,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      return ctx.prisma.game.findUnique({
        ...query,
        where: { id: args.id },
      });
    },
  })
);
