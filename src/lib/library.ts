import { GameStatus, type PrismaClient } from "@prisma/client";

/**
 * Resolve which Game rows a bundle contributes to the library: one game per
 * included family, on the given platform when set, else on any of the
 * bundle's platforms. `requestedFamilyIds` narrows to a user selection;
 * ids not in the bundle are ignored.
 */
export async function resolveBundleLibraryGames(
  prisma: PrismaClient,
  bundle: {
    gameFamilies: Array<{ id: string }>;
    platforms: Array<{ id: string }>;
  },
  platformId: string | null,
  requestedFamilyIds: string[]
): Promise<Array<{ id: string; platformId: string | null }>> {
  const bundleFamilyIds = new Set(bundle.gameFamilies.map((f) => f.id));
  const familyIds = requestedFamilyIds.filter((id) => bundleFamilyIds.has(id));
  if (familyIds.length === 0) return [];

  const bundlePlatformIds = bundle.platforms.map((p) => p.id);
  const games = await prisma.game.findMany({
    where: {
      gameFamilyId: { in: familyIds },
      ...(platformId
        ? { platformId }
        : bundlePlatformIds.length > 0
          ? { platformId: { in: bundlePlatformIds } }
          : {}),
    },
    select: { id: true, gameFamilyId: true, platformId: true },
  });

  // One game per family: without an explicit platform, a family could match
  // on several of the bundle's platforms
  const seenFamilies = new Set<string>();
  return games.filter((game) => {
    if (!game.gameFamilyId || seenFamilies.has(game.gameFamilyId)) {
      return false;
    }
    seenFamilies.add(game.gameFamilyId);
    return true;
  });
}

/**
 * Add games to a user's library as BACKLOG entries.
 *
 * Existing library entries are left untouched: the unique [userId, gameId]
 * constraint plus skipDuplicates makes this idempotent, so a game the user
 * already tracks (any status) is never overwritten.
 */
export async function addGamesToLibrary(
  prisma: PrismaClient,
  userId: string,
  games: Array<{
    id: string;
    platformId: string | null;
    gameVersionId?: string | null;
  }>
): Promise<number> {
  if (games.length === 0) return 0;

  const result = await prisma.userGame.createMany({
    data: games.map((game) => ({
      userId,
      gameId: game.id,
      platformId: game.platformId,
      gameVersionId: game.gameVersionId ?? null,
      status: GameStatus.BACKLOG,
    })),
    skipDuplicates: true,
  });

  return result.count;
}
