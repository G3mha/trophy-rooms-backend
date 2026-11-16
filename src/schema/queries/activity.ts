import { builder } from "../builder.js";
import { POINTS_DEPRECATION, USER_EMAIL_DEPRECATION } from "../deprecations.js";
import { visibleSetWhere } from "../../lib/achievement-visibility.js";
import type { Prisma, PrismaClient } from "@prisma/client";
import { notPlatinum } from "../../lib/trophies.js";

/**
 * Leaves bulk-written completions out of the achievement feed.
 *
 * Imports write many completions with the same createdAt, so one import of a
 * 135-achievement game would fill the whole feed with one player. A player's
 * own ticks never share a timestamp, which is what tells the two apart without
 * a schema change.
 *
 * The Platinum is left out of the feed for the same reason (notPlatinum): it
 * is completed together with the trophy, which already has its own entry.
 *
 * Only the 100 most recent groups are excluded, which covers any feed page:
 * an older group could only surface behind 100 newer ones.
 */
async function withoutBulkMarked(prisma: PrismaClient): Promise<Prisma.UserAchievementWhereInput> {
  const groups = await prisma.userAchievement.groupBy({
    by: ["userId", "createdAt"],
    having: { achievementId: { _count: { gt: 1 } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  if (groups.length === 0) return {};
  return { NOT: groups.map((group) => ({ userId: group.userId, createdAt: group.createdAt })) };
}

// Activity feed entry type
const ActivityFeedEntry = builder.objectRef<{
  id: string;
  userId: string;
  userName: string | null;
  achievementId: string;
  achievementTitle: string;
  achievementTier: string;
  achievementPoints: number;
  gameFamilyId: string;
  gameTitle: string;
  earnedAt: Date;
}>("ActivityFeedEntry");

ActivityFeedEntry.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    userId: t.exposeString("userId"),
    userName: t.exposeString("userName", { nullable: true }),
    // Compatibility shim for shipped clients - see ../deprecations.js
    userEmail: t.string({
      deprecationReason: USER_EMAIL_DEPRECATION,
      resolve: () => "",
    }),
    achievementId: t.exposeString("achievementId"),
    achievementTitle: t.exposeString("achievementTitle"),
    achievementTier: t.exposeString("achievementTier"),
    achievementPoints: t.exposeInt("achievementPoints", { deprecationReason: POINTS_DEPRECATION }),
    gameFamilyId: t.exposeString("gameFamilyId"),
    gameTitle: t.exposeString("gameTitle"),
    earnedAt: t.expose("earnedAt", { type: "DateTime" }),
  }),
});

// Trophy earned activity entry
const TrophyActivityEntry = builder.objectRef<{
  id: string;
  userId: string;
  userName: string | null;
  gameId: string;
  gameFamilyId: string;
  gameTitle: string;
  earnedAt: Date;
}>("TrophyActivityEntry");

TrophyActivityEntry.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    userId: t.exposeString("userId"),
    userName: t.exposeString("userName", { nullable: true }),
    // Compatibility shim for shipped clients - see ../deprecations.js
    userEmail: t.string({
      deprecationReason: USER_EMAIL_DEPRECATION,
      resolve: () => "",
    }),
    gameId: t.exposeString("gameId"),
    gameFamilyId: t.exposeString("gameFamilyId"),
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
  achievementId?: string;
  achievementTitle?: string;
  achievementTier?: string;
  achievementPoints?: number;
  gameId?: string;
  gameFamilyId: string;
  gameTitle: string;
  platformName?: string;
  platformSlug?: string;
  earnedAt: Date;
}>("CombinedActivityEntry");

CombinedActivityEntry.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    type: t.exposeString("type"),
    userId: t.exposeString("userId"),
    userName: t.exposeString("userName", { nullable: true }),
    // Compatibility shim for shipped clients - see ../deprecations.js
    userEmail: t.string({
      deprecationReason: USER_EMAIL_DEPRECATION,
      resolve: () => "",
    }),
    achievementId: t.exposeString("achievementId", { nullable: true }),
    achievementTitle: t.exposeString("achievementTitle", { nullable: true }),
    achievementTier: t.exposeString("achievementTier", { nullable: true }),
    achievementPoints: t.exposeInt("achievementPoints", { nullable: true, deprecationReason: POINTS_DEPRECATION }),
    gameId: t.exposeString("gameId", { nullable: true }),
    gameFamilyId: t.exposeString("gameFamilyId"),
    gameTitle: t.exposeString("gameTitle"),
    platformName: t.exposeString("platformName", { nullable: true }),
    platformSlug: t.exposeString("platformSlug", { nullable: true }),
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
        // Hide completions of achievements in sets this viewer can't see
        where: {
          achievement: { ...notPlatinum, achievementSet: visibleSetWhere(ctx.user) },
          ...(await withoutBulkMarked(ctx.prisma)),
        },
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { id: true, name: true },
          },
          achievement: {
            select: {
              id: true,
              title: true,
              tier: true,
              points: true,
              achievementSet: {
                select: {
                  gameFamily: {
                    select: {
                      id: true,
                      title: true,
                    },
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
        achievementId: ua.achievement.id,
        achievementTitle: ua.achievement.title,
        achievementTier: ua.achievement.tier,
        achievementPoints: ua.achievement.points,
        gameFamilyId: ua.achievement.achievementSet.gameFamily?.id ?? "",
        gameTitle: ua.achievement.achievementSet.gameFamily?.title ?? "Unknown",
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
            select: { id: true, name: true },
          },
          game: {
            select: {
              id: true,
              gameFamilyId: true,
              gameFamily: {
                select: { id: true, title: true },
              },
            },
          },
        },
      });

      return recentTrophies.map((t) => ({
        id: t.id,
        userId: t.user.id,
        userName: t.user.name,
        gameId: t.game.id,
        gameFamilyId: t.game.gameFamily?.id ?? t.game.gameFamilyId ?? "",
        gameTitle: t.game.gameFamily?.title ?? "Unknown",
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

      const notBulkMarked = await withoutBulkMarked(ctx.prisma);

      // Fetch both achievements and trophies
      const [achievements, trophies] = await Promise.all([
        ctx.prisma.userAchievement.findMany({
          where: { achievement: { ...notPlatinum, achievementSet: visibleSetWhere(ctx.user) }, ...notBulkMarked },
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: { id: true, name: true },
            },
            achievement: {
              select: {
                id: true,
                title: true,
                tier: true,
                points: true,
                achievementSet: {
                  select: {
                    gameFamily: {
                      select: {
                        id: true,
                        title: true,
                      },
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
              select: { id: true, name: true },
            },
            game: {
              select: {
                id: true,
                gameFamilyId: true,
                gameFamily: {
                  select: { id: true, title: true },
                },
                platform: {
                  select: { name: true, slug: true },
                },
              },
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
        achievementId?: string;
        achievementTitle?: string;
        achievementTier?: string;
        achievementPoints?: number;
        gameId?: string;
        gameFamilyId: string;
        gameTitle: string;
        platformName?: string;
        platformSlug?: string;
        earnedAt: Date;
      }> = achievements.map((ua) => ({
        id: `achievement-${ua.id}`,
        type: "achievement" as const,
        userId: ua.user.id,
        userName: ua.user.name,
        achievementId: ua.achievement.id,
        achievementTitle: ua.achievement.title,
        achievementTier: ua.achievement.tier,
        achievementPoints: ua.achievement.points,
        gameFamilyId: ua.achievement.achievementSet.gameFamily?.id ?? "",
        gameTitle: ua.achievement.achievementSet.gameFamily?.title ?? "Unknown",
        earnedAt: ua.createdAt,
      }));

      const trophyEntries: Array<{
        id: string;
        type: "achievement" | "trophy";
        userId: string;
        userName: string | null;
        achievementId?: string;
        achievementTitle?: string;
        achievementTier?: string;
        achievementPoints?: number;
        gameId?: string;
        gameFamilyId: string;
        gameTitle: string;
        platformName?: string;
        platformSlug?: string;
        earnedAt: Date;
      }> = trophies.map((t) => ({
        id: `trophy-${t.id}`,
        type: "trophy" as const,
        userId: t.user.id,
        userName: t.user.name,
        gameId: t.game.id,
        gameFamilyId: t.game.gameFamily?.id ?? t.game.gameFamilyId ?? "",
        gameTitle: t.game.gameFamily?.title ?? "Unknown",
        platformName: t.game.platform?.name,
        platformSlug: t.game.platform?.slug,
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
