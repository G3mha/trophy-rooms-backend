import { Prisma, AchievementSetVisibility, UserRole } from "@prisma/client";
import { builder } from "../builder.js";
import { hasRequiredRole } from "../../context.js";

builder.queryField("achievementSets", (t) =>
  t.prismaField({
    type: ["AchievementSet"],
    args: {
      gameId: t.arg.id(),
      visibility: t.arg({ type: "AchievementSetVisibility" }),
      type: t.arg({ type: "AchievementSetType" }),
    },
    resolve: (query, _root, args, ctx) => {
      const where: Prisma.AchievementSetWhereInput = {};

      if (args.gameId) {
        where.gameId = args.gameId;
      }

      if (args.type) {
        where.type = args.type;
      }

      if (args.visibility) {
        where.visibility = args.visibility;
      }

      const visibilityScope = !ctx.user
        ? { visibility: AchievementSetVisibility.PUBLIC }
        : hasRequiredRole(ctx.user, UserRole.TRUSTED)
          ? {}
          : {
              OR: [
                { visibility: AchievementSetVisibility.PUBLIC },
                { createdByUserId: ctx.user.id },
              ],
            };

      if (Object.keys(visibilityScope).length > 0) {
        where.AND = [...(where.AND ?? []), visibilityScope];
      }

      return ctx.prisma.achievementSet.findMany({
        ...query,
        where,
        orderBy: { title: "asc" },
      });
    },
  })
);

builder.queryField("myAchievementSets", (t) =>
  t.prismaField({
    type: ["AchievementSet"],
    resolve: (query, _root, _args, ctx) => {
      if (!ctx.user) {
        return [];
      }

      return ctx.prisma.achievementSet.findMany({
        ...query,
        where: { createdByUserId: ctx.user.id },
        orderBy: { createdAt: "desc" },
      });
    },
  })
);
