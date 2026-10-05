import {
  AchievementSetType,
  AchievementSetVisibility,
  type Prisma,
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
