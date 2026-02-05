import { Prisma, UserRole } from "@prisma/client";
import { builder } from "../builder.js";
import { hasRequiredRole } from "../../context.js";

builder.queryField("users", (t) =>
  t.prismaConnection({
    type: "User",
    cursor: "id",
    args: {
      search: t.arg.string(),
    },
    totalCount: async (_connection, args, ctx) => {
      if (!hasRequiredRole(ctx.user, UserRole.ADMIN)) {
        return 0;
      }

      const where: Prisma.UserWhereInput = {};
      if (args.search) {
        where.OR = [
          { email: { contains: args.search, mode: "insensitive" } },
          { name: { contains: args.search, mode: "insensitive" } },
        ];
      }

      return ctx.prisma.user.count({ where });
    },
    resolve: (query, _root, args, ctx) => {
      if (!hasRequiredRole(ctx.user, UserRole.ADMIN)) {
        return [];
      }

      const where: Prisma.UserWhereInput = {};
      if (args.search) {
        where.OR = [
          { email: { contains: args.search, mode: "insensitive" } },
          { name: { contains: args.search, mode: "insensitive" } },
        ];
      }

      return ctx.prisma.user.findMany({
        ...query,
        where,
        orderBy: { createdAt: "desc" },
      });
    },
  })
);
