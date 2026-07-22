import { GameStatus, type PrismaClient } from "@prisma/client";

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
