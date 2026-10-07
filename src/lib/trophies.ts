import {
  AchievementSetType,
  AchievementSetVisibility,
  Prisma,
  type PrismaClient,
} from "@prisma/client";

/**
 * Achievement sets that count towards a game's trophy: official and
 * completionist sets, plus custom sets their creator has made public.
 * Private custom sets are personal checklists, so they neither gate a trophy
 * nor count in progress towards one.
 */
export const trophyEligibleSetWhere = {
  OR: [
    { type: { in: [AchievementSetType.OFFICIAL, AchievementSetType.COMPLETIONIST] } },
    { type: AchievementSetType.CUSTOM, visibility: AchievementSetVisibility.PUBLIC },
  ],
} satisfies Prisma.AchievementSetWhereInput;

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
