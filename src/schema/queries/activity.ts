import { builder } from "../builder.js";

// Activity feed entry type
const ActivityFeedEntry = builder.objectRef<{
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  achievementId: string;
  achievementTitle: string;
  achievementTier: string;
  achievementPoints: number;
  gameId: string;
  gameTitle: string;
  earnedAt: Date;
}>("ActivityFeedEntry");

ActivityFeedEntry.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    userId: t.exposeString("userId"),
    userName: t.exposeString("userName", { nullable: true }),
    userEmail: t.exposeString("userEmail"),
    achievementId: t.exposeString("achievementId"),
    achievementTitle: t.exposeString("achievementTitle"),
    achievementTier: t.exposeString("achievementTier"),
    achievementPoints: t.exposeInt("achievementPoints"),
    gameId: t.exposeString("gameId"),
    gameTitle: t.exposeString("gameTitle"),
    earnedAt: t.expose("earnedAt", { type: "DateTime" }),
  }),
});

// Trophy earned activity entry
const TrophyActivityEntry = builder.objectRef<{
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  gameId: string;
  gameTitle: string;
  earnedAt: Date;
}>("TrophyActivityEntry");

TrophyActivityEntry.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    userId: t.exposeString("userId"),
    userName: t.exposeString("userName", { nullable: true }),
    userEmail: t.exposeString("userEmail"),
    gameId: t.exposeString("gameId"),
    gameTitle: t.exposeString("gameTitle"),
    earnedAt: t.expose("earnedAt", { type: "DateTime" }),
  }),
});

// Combined activity feed (achievements + trophies)
const CombinedActivityEntry = builder.objectRef<{
  id: string;
  type: "achievement" | "trophy";
  userId: string;
  userName: string | null;
  userEmail: string;
  achievementId?: string;
  achievementTitle?: string;
  achievementTier?: string;
  achievementPoints?: number;
  gameId: string;
  gameTitle: string;
  earnedAt: Date;
}>("CombinedActivityEntry");

CombinedActivityEntry.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    type: t.exposeString("type"),
    userId: t.exposeString("userId"),
    userName: t.exposeString("userName", { nullable: true }),
    userEmail: t.exposeString("userEmail"),
    achievementId: t.exposeString("achievementId", { nullable: true }),
    achievementTitle: t.exposeString("achievementTitle", { nullable: true }),
    achievementTier: t.exposeString("achievementTier", { nullable: true }),
    achievementPoints: t.exposeInt("achievementPoints", { nullable: true }),
    gameId: t.exposeString("gameId"),
    gameTitle: t.exposeString("gameTitle"),
    earnedAt: t.expose("earnedAt", { type: "DateTime" }),
  }),
});

// Recent community activity - achievements
builder.queryField("recentAchievementActivity", (t) =>
  t.field({
    type: [ActivityFeedEntry],
    args: {
      limit: t.arg.int({ required: false, defaultValue: 20 }),
    },
    resolve: async (_root, args, ctx) => {
      const limit = Math.min(args.limit || 20, 50);

      const recentAchievements = await ctx.prisma.userAchievement.findMany({
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          achievement: {
            select: {
              id: true,
              title: true,
              tier: true,
              points: true,
              achievementSet: {
                select: {
                  game: {
                    select: { id: true, title: true },
                  },
                },
              },
            },
          },
        },
      });

      return recentAchievements.map((ua) => ({
        id: ua.id,
        userId: ua.user.id,
        userName: ua.user.name,
        userEmail: ua.user.email,
        achievementId: ua.achievement.id,
        achievementTitle: ua.achievement.title,
        achievementTier: ua.achievement.tier,
        achievementPoints: ua.achievement.points,
        gameId: ua.achievement.achievementSet.game.id,
        gameTitle: ua.achievement.achievementSet.game.title,
        earnedAt: ua.createdAt,
      }));
    },
  })
);

// Recent trophy activity
builder.queryField("recentTrophyActivity", (t) =>
  t.field({
    type: [TrophyActivityEntry],
    args: {
      limit: t.arg.int({ required: false, defaultValue: 10 }),
    },
    resolve: async (_root, args, ctx) => {
      const limit = Math.min(args.limit || 10, 50);

      const recentTrophies = await ctx.prisma.trophy.findMany({
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          game: {
            select: { id: true, title: true },
          },
        },
      });

      return recentTrophies.map((t) => ({
        id: t.id,
        userId: t.user.id,
        userName: t.user.name,
        userEmail: t.user.email,
        gameId: t.game.id,
        gameTitle: t.game.title,
        earnedAt: t.createdAt,
      }));
    },
  })
);

// Combined activity feed (achievements + trophies merged and sorted)
builder.queryField("activityFeed", (t) =>
  t.field({
    type: [CombinedActivityEntry],
    args: {
      limit: t.arg.int({ required: false, defaultValue: 30 }),
    },
    resolve: async (_root, args, ctx) => {
      const limit = Math.min(args.limit || 30, 100);

      // Fetch both achievements and trophies
      const [achievements, trophies] = await Promise.all([
        ctx.prisma.userAchievement.findMany({
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
            achievement: {
              select: {
                id: true,
                title: true,
                tier: true,
                points: true,
                achievementSet: {
                  select: {
                    game: {
                      select: { id: true, title: true },
                    },
                  },
                },
              },
            },
          },
        }),
        ctx.prisma.trophy.findMany({
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
            game: {
              select: { id: true, title: true },
            },
          },
        }),
      ]);

      // Convert to combined format
      const achievementEntries: Array<{
        id: string;
        type: "achievement" | "trophy";
        userId: string;
        userName: string | null;
        userEmail: string;
        achievementId?: string;
        achievementTitle?: string;
        achievementTier?: string;
        achievementPoints?: number;
        gameId: string;
        gameTitle: string;
        earnedAt: Date;
      }> = achievements.map((ua) => ({
        id: `achievement-${ua.id}`,
        type: "achievement" as const,
        userId: ua.user.id,
        userName: ua.user.name,
        userEmail: ua.user.email,
        achievementId: ua.achievement.id,
        achievementTitle: ua.achievement.title,
        achievementTier: ua.achievement.tier,
        achievementPoints: ua.achievement.points,
        gameId: ua.achievement.achievementSet.game.id,
        gameTitle: ua.achievement.achievementSet.game.title,
        earnedAt: ua.createdAt,
      }));

      const trophyEntries: Array<{
        id: string;
        type: "achievement" | "trophy";
        userId: string;
        userName: string | null;
        userEmail: string;
        achievementId?: string;
        achievementTitle?: string;
        achievementTier?: string;
        achievementPoints?: number;
        gameId: string;
        gameTitle: string;
        earnedAt: Date;
      }> = trophies.map((t) => ({
        id: `trophy-${t.id}`,
        type: "trophy" as const,
        userId: t.user.id,
        userName: t.user.name,
        userEmail: t.user.email,
        gameId: t.game.id,
        gameTitle: t.game.title,
        earnedAt: t.createdAt,
      }));

      // Merge and sort by date
      const combined = [...achievementEntries, ...trophyEntries]
        .sort((a, b) => b.earnedAt.getTime() - a.earnedAt.getTime())
        .slice(0, limit);

      return combined;
    },
  })
);
