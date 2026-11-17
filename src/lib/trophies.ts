import {
  AchievementSetType,
  AchievementSetVisibility,
  AchievementTier,
  Prisma,
  type PrismaClient,
} from "@prisma/client";

/**
 * Achievement sets that count towards a game's trophy: official and
 * completionist sets, plus custom sets their creator has made public, less
 * any set whose `countsTowardTrophy` has been cleared.
 *
 * Private custom sets are personal checklists, so they neither gate a trophy
 * nor count in progress towards one.
 *
 * `countsTowardTrophy` is here because a game can ship two real lists that
 * restate each other. Resident Evil Requiem has both a PSN trophy list and an
 * in-game Challenges list, and 49 of the 50 challenges are the same
 * accomplishments as the trophies under the same names. A trophy needs every
 * achievement in every eligible set, so carrying both lists unflagged made
 * the trophy ask for 100 ticks covering 51 distinct accomplishments. Clearing
 * the flag on the restating list leaves it browsable and tickable without
 * doubling the bar.
 *
 * The rule stays "finish every eligible set" rather than "finish any one of
 * them". Any user can create a custom set and publish it, so crediting a
 * trophy for a single completed set would let a one-achievement public set
 * hand out trophies for free. Requiring all of them means an extra set can
 * only ever raise the bar, never lower it, which is why the escape hatch is
 * an explicit flag rather than a rule the data can trip on its own.
 *
 * Both the earned and the total side of progress read this same filter
 * (queries/game-progress.ts), so they cannot drift apart.
 */
export const trophyEligibleSetWhere = {
  countsTowardTrophy: true,
  OR: [
    { type: { in: [AchievementSetType.OFFICIAL, AchievementSetType.COMPLETIONIST] } },
    { type: AchievementSetType.CUSTOM, visibility: AchievementSetVisibility.PUBLIC },
  ],
} satisfies Prisma.AchievementSetWhereInput;

/**
 * The achievements a player ticks towards a trophy leave out the Platinum.
 *
 * A list's Platinum-tier achievement is the trophy itself, under the game's
 * own name ("Jump Up, Super Star!"). It stands for finishing everything else,
 * so it is derived: awardTrophyIfComplete completes it for the player, and
 * neither progress nor the trophy rule counts it. Counting it would make the
 * trophy require a tick that means "you have the trophy".
 *
 * Spread this into every Achievement filter that feeds progress or awarding,
 * next to trophyEligibleSetWhere on the set.
 */
export const notPlatinum = {
  tier: { not: AchievementTier.PLATINUM },
} satisfies Prisma.AchievementWhereInput;

/**
 * How to list a game's sets: the ones that count towards its trophy first, so
 * a set that merely restates another never leads the page.
 */
export const trophySetsFirstOrderBy = [
  { countsTowardTrophy: "desc" },
  { title: "asc" },
] satisfies Prisma.AchievementSetOrderByWithRelationInput[];

type TrophyGameCandidate = {
  id: string;
  releaseDate: Date | null;
  createdAt: Date;
};

/**
 * Pick which of a family's games carry a user's trophy for completing it.
 *
 * Achievements belong to the GameFamily but trophies belong to a Game, so
 * awarding one per platform game made a three-platform release count as three
 * trophies. A trophy goes on each edition the user has in their library. A
 * user who never added the game still earns one trophy, on the family's
 * earliest release.
 */
export function pickTrophyGames<T extends TrophyGameCandidate>(
  games: T[],
  libraryGameIds: ReadonlySet<string>
): T[] {
  const inLibrary = games.filter((game) => libraryGameIds.has(game.id));
  if (inLibrary.length > 0) return inLibrary;

  const [earliest] = [...games].sort(compareByRelease);
  return earliest ? [earliest] : [];
}

/**
 * Award a user the family's trophy once every trophy-eligible achievement in
 * it is complete. Achievements belong to the GameFamily but trophies belong to
 * a Game, so pickTrophyGames decides which editions carry it. Safe to call
 * again: existing trophies are skipped.
 */
export async function awardTrophyIfComplete(
  prisma: PrismaClient,
  userId: string,
  gameFamilyId: string
): Promise<void> {
  const eligibleSet = { gameFamilyId, ...trophyEligibleSetWhere };
  const eligible = { ...notPlatinum, achievementSet: eligibleSet };
  const totalAchievements = await prisma.achievement.count({ where: eligible });
  if (totalAchievements === 0) return;

  const completedCount = await prisma.userAchievement.count({
    where: { userId, achievement: eligible },
  });
  if (completedCount < totalAchievements) return;

  const gamesInFamily = await prisma.game.findMany({
    where: { gameFamilyId },
    select: {
      id: true,
      releaseDate: true,
      createdAt: true,
      userGames: { where: { userId }, select: { id: true } },
    },
  });
  const libraryGameIds = new Set(
    gamesInFamily.filter((game) => game.userGames.length > 0).map((game) => game.id)
  );

  await prisma.trophy.createMany({
    data: pickTrophyGames(gamesInFamily, libraryGameIds).map((game) => ({ userId, gameId: game.id })),
    skipDuplicates: true,
  });

  // The Platinum is the trophy, so it is completed along with it
  const platinum = await prisma.achievement.findMany({
    where: { tier: AchievementTier.PLATINUM, achievementSet: eligibleSet },
    select: { id: true },
  });
  if (platinum.length > 0) {
    await prisma.userAchievement.createMany({
      data: platinum.map((achievement) => ({ userId, achievementId: achievement.id })),
      skipDuplicates: true,
    });
  }
}

/**
 * Settle a family's trophies after it lost achievements that counted: a list
 * stopped counting or was deleted, or achievements were removed from one.
 */
export async function settleTrophiesAfterRemoval(
  prisma: PrismaClient,
  gameFamilyId: string
): Promise<void> {
  const eligibleSet = { gameFamilyId, ...trophyEligibleSetWhere };
  const eligible = { ...notPlatinum, achievementSet: eligibleSet };
  const total = await prisma.achievement.count({ where: eligible });

  if (total === 0) {
    // A game with nothing left to finish has no trophy, or publishing a
    // one-achievement list and withdrawing it would leave one behind
    await prisma.trophy.deleteMany({ where: { game: { gameFamilyId } } });
    // The Platinum is the trophy, so it goes with it
    await prisma.userAchievement.deleteMany({
      where: { achievement: { tier: AchievementTier.PLATINUM, achievementSet: eligibleSet } },
    });
    return;
  }

  // A shorter bar can finish the game for players who will never tick again.
  // Holders finished a longer one, so they are left alone.
  const finished = await prisma.userAchievement.groupBy({
    by: ["userId"],
    where: {
      achievement: eligible,
      user: { trophies: { none: { game: { gameFamilyId } } } },
    },
    having: { achievementId: { _count: { gte: total } } },
  });
  for (const { userId } of finished) {
    await awardTrophyIfComplete(prisma, userId, gameFamilyId);
  }
}

// Earliest release first, undated games last; createdAt and id keep the pick
// stable between the mutation and the cleanup script
function compareByRelease(a: TrophyGameCandidate, b: TrophyGameCandidate): number {
  const aRelease = a.releaseDate?.getTime() ?? Number.POSITIVE_INFINITY;
  const bRelease = b.releaseDate?.getTime() ?? Number.POSITIVE_INFINITY;
  if (aRelease !== bRelease) return aRelease - bRelease;
  const byCreated = a.createdAt.getTime() - b.createdAt.getTime();
  if (byCreated !== 0) return byCreated;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// A user earns one trophy per game family, but it is stored on each of their
// library editions (pickTrophyGames), so counts of finished games go through
// families: distinct families per user, distinct users per family. Counting
// Trophy rows would count a game twice for someone who owns two editions.

/** Finished games (distinct families with a trophy) per user. */
export async function countFinishedGames(
  prisma: PrismaClient,
  userIds: string[]
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<Array<{ userId: string; count: number }>>`
    SELECT t."userId", COUNT(DISTINCT g."gameFamilyId")::int AS count
    FROM "Trophy" t
    JOIN "Game" g ON g.id = t."gameId"
    WHERE t."userId" IN (${Prisma.join(userIds)})
    GROUP BY t."userId"
  `;
  return new Map(rows.map((row) => [row.userId, row.count]));
}

/** Users with the most finished games, most first. */
export async function topUsersByFinishedGames(
  prisma: PrismaClient,
  limit: number
): Promise<Array<{ userId: string; count: number }>> {
  return prisma.$queryRaw<Array<{ userId: string; count: number }>>`
    SELECT t."userId", COUNT(DISTINCT g."gameFamilyId")::int AS count
    FROM "Trophy" t
    JOIN "Game" g ON g.id = t."gameId"
    GROUP BY t."userId"
    ORDER BY count DESC, t."userId" ASC
    LIMIT ${limit}
  `;
}

/** Players who finished each family (distinct users with a trophy on any of its editions). */
export async function countTrophyHolders(
  prisma: PrismaClient,
  familyIds: string[]
): Promise<Map<string, number>> {
  if (familyIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<Array<{ familyId: string; count: number }>>`
    SELECT g."gameFamilyId" AS "familyId", COUNT(DISTINCT t."userId")::int AS count
    FROM "Trophy" t
    JOIN "Game" g ON g.id = t."gameId"
    WHERE g."gameFamilyId" IN (${Prisma.join(familyIds)})
    GROUP BY g."gameFamilyId"
  `;
  return new Map(rows.map((row) => [row.familyId, row.count]));
}
