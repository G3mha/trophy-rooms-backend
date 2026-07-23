import {
  Prisma,
  AchievementSetVisibility,
  AchievementSetType,
} from "@prisma/client";
import { builder } from "../builder.js";

builder.queryField("achievementSet", (t) =>
  t.prismaField({
    type: "AchievementSet",
    nullable: true,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      return ctx.prisma.achievementSet.findUnique({
        ...query,
        where: { id: String(args.id) },
      });
    },
  })
);

builder.queryField("achievementSets", (t) =>
  t.prismaField({
    type: ["AchievementSet"],
    args: {
      gameFamilyId: t.arg.id(),
      visibility: t.arg({ type: AchievementSetVisibility }),
      type: t.arg({ type: AchievementSetType }),
    },
    resolve: async (query, _root, args, ctx) => {
      try {
        const where: Prisma.AchievementSetWhereInput = {};

        if (args.gameFamilyId) {
          where.gameFamilyId = args.gameFamilyId;
        }

        if (args.type) {
          where.type = args.type;
        }

        if (args.visibility) {
          where.visibility = args.visibility;
        }

        return await ctx.prisma.achievementSet.findMany({
          ...query,
          where,
          orderBy: { title: "asc" },
        });
      } catch (error) {
        console.error("achievementSets query error:", error);
        return [];
      }
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
