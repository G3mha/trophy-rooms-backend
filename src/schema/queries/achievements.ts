import { Prisma } from "@prisma/client";
import { builder } from "../builder.js";
import {
  AchievementsFilterInput,
  AchievementOrderBy,
} from "../types/achievement.js";

// Achievements connection with cursor-based pagination
builder.queryField("achievements", (t) =>
  t.prismaConnection({
    type: "Achievement",
    cursor: "id",
    args: {
      filter: t.arg({ type: AchievementsFilterInput }),
      orderBy: t.arg({ type: AchievementOrderBy }),
    },
    totalCount: (_connection, _args, ctx) => ctx.prisma.achievement.count(),
    resolve: async (query, _root, args, ctx) => {
      const { filter, orderBy } = args;

      // Build where clause
      const where: Prisma.AchievementWhereInput = {};

      if (filter?.search) {
        where.OR = [
          { title: { contains: filter.search, mode: "insensitive" } },
          { description: { contains: filter.search, mode: "insensitive" } },
        ];
      }

      if (filter?.gameId) {
        where.gameId = filter.gameId;
      }

      // Filter by completion status for authenticated users
      if (ctx.user && (filter?.onlyCompleted || filter?.onlyIncomplete)) {
        if (filter.onlyCompleted) {
          where.users = {
            some: { userId: ctx.user.id },
          };
        } else if (filter.onlyIncomplete) {
          where.users = {
            none: { userId: ctx.user.id },
          };
        }
      }

      // Build order by clause
      let orderByClause: Prisma.AchievementOrderByWithRelationInput;

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
        case "USER_COUNT_DESC":
          orderByClause = { users: { _count: "desc" } };
          break;
        case "TITLE_ASC":
        default:
          orderByClause = { title: "asc" };
          break;
      }

      return ctx.prisma.achievement.findMany({
        ...query,
        where,
        orderBy: orderByClause,
      });
    },
  })
);

// Single achievement query
builder.queryField("achievement", (t) =>
  t.prismaField({
    type: "Achievement",
    nullable: true,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      return ctx.prisma.achievement.findUnique({
        ...query,
        where: { id: args.id },
      });
    },
  })
);
