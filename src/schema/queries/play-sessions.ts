import { builder } from "../builder.js";

// Aggregate stats for the play journal header
const PlayStats = builder.objectRef<{
  totalMinutes: number;
  sessionCount: number;
  daysLogged: number;
  currentStreakDays: number;
  thisWeekMinutes: number;
}>("PlayStats");

PlayStats.implement({
  fields: (t) => ({
    totalMinutes: t.exposeInt("totalMinutes"),
    sessionCount: t.exposeInt("sessionCount"),
    daysLogged: t.exposeInt("daysLogged"),
    currentStreakDays: t.exposeInt("currentStreakDays"),
    thisWeekMinutes: t.exposeInt("thisWeekMinutes"),
  }),
});

builder.queryField("myPlaySessions", (t) =>
  t.prismaField({
    type: ["PlaySession"],
    args: {
      from: t.arg({ type: "DateTime", required: false }),
      to: t.arg({ type: "DateTime", required: false }),
      gameId: t.arg.id({ required: false }),
      limit: t.arg.int({ required: false, defaultValue: 200 }),
    },
    resolve: async (query, _root, args, ctx) => {
      if (!ctx.user) return [];

      return ctx.prisma.playSession.findMany({
        ...query,
        where: {
          userId: ctx.user.id,
          ...(args.gameId ? { gameId: String(args.gameId) } : {}),
          ...(args.from || args.to
            ? {
                playedOn: {
                  ...(args.from ? { gte: args.from } : {}),
                  ...(args.to ? { lte: args.to } : {}),
                },
              }
            : {}),
        },
        orderBy: [{ playedOn: "desc" }, { createdAt: "desc" }],
        take: Math.min(args.limit ?? 200, 500),
      });
    },
  })
);

builder.queryField("myPlayStats", (t) =>
  t.field({
    type: PlayStats,
    resolve: async (_root, _args, ctx) => {
      if (!ctx.user) {
        return {
          totalMinutes: 0,
          sessionCount: 0,
          daysLogged: 0,
          currentStreakDays: 0,
          thisWeekMinutes: 0,
        };
      }

      const sessions = await ctx.prisma.playSession.findMany({
        where: { userId: ctx.user.id },
        select: { minutes: true, playedOn: true },
      });

      const iso = (d: Date) => d.toISOString().slice(0, 10);
      const days = new Set(sessions.map((s) => iso(s.playedOn)));

      const now = new Date();
      const todayUTC = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      );

      // Streak: consecutive days with a session. Not having played *today*
      // yet does not break it - the streak then counts back from yesterday.
      let streak = 0;
      const cursor = new Date(todayUTC);
      if (!days.has(iso(cursor))) {
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      }
      while (days.has(iso(cursor))) {
        streak++;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      }

      const weekStart = new Date(todayUTC);
      weekStart.setUTCDate(weekStart.getUTCDate() - 6);
      const thisWeekMinutes = sessions
        .filter((s) => s.playedOn >= weekStart)
        .reduce((sum, s) => sum + s.minutes, 0);

      return {
        totalMinutes: sessions.reduce((sum, s) => sum + s.minutes, 0),
        sessionCount: sessions.length,
        daysLogged: days.size,
        currentStreakDays: streak,
        thisWeekMinutes,
      };
    },
  })
);
