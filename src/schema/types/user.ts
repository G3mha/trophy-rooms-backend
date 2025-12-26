import { builder } from "../builder.js";

builder.prismaObject("User", {
  fields: (t) => ({
    id: t.exposeID("id"),
    email: t.exposeString("email"),
    name: t.exposeString("name", { nullable: true }),
    achievements: t.relation("achievements", {
      query: {
        orderBy: { createdAt: "desc" },
      },
    }),
    trophies: t.relation("trophies", {
      query: {
        orderBy: { createdAt: "desc" },
      },
    }),
    achievementCount: t.relationCount("achievements"),
    trophyCount: t.relationCount("trophies"),
    // Count of unique games where user has at least one achievement
    gamesWithAchievementsCount: t.int({
      resolve: async (user, _args, ctx) => {
        const result = await ctx.prisma.userAchievement.findMany({
          where: { userId: user.id },
          select: {
            achievement: {
              select: { gameId: true },
            },
          },
          distinct: ["achievementId"],
        });
        const uniqueGameIds = new Set(result.map((r) => r.achievement.gameId));
        return uniqueGameIds.size;
      },
    }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});
