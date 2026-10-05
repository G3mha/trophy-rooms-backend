/**
 * Remove the extra Trophy rows that markAchievementComplete used to create.
 *
 * Completing a family's achievements awarded a trophy on every Game in the
 * family, so a game released on three platforms gave the user three trophies.
 * leaderboardByTrophies counted every row. The mutation now uses
 * pickTrophyGames (src/lib/trophies.ts): a trophy on each edition in the
 * user's library, or one trophy on the earliest release when none is.
 *
 * This applies the same rule to existing data. For every (user, family) with
 * more than one trophy, it keeps the trophies pickTrophyGames selects and
 * deletes the rest. Kept rows are untouched, so their createdAt (used for
 * trophyEarnedAt and fastestCompletions) is preserved. It never creates
 * trophies, never deletes a user's only trophy for a family, and leaves
 * trophies on games without a family alone.
 *
 * Usage:
 *   npx tsx scripts/fix-duplicate-trophies.ts           # dry run, prints the plan
 *   npx tsx scripts/fix-duplicate-trophies.ts --apply   # deletes, in one transaction
 */

import { PrismaClient } from "@prisma/client";
import { pickTrophyGames } from "../src/lib/trophies.js";

const prisma = new PrismaClient();

const DELETE_BATCH_SIZE = 1000;

async function main() {
  const apply = process.argv.slice(2).includes("--apply");

  console.log("=== Fix Duplicate Trophies ===\n");
  console.log(`Mode: ${apply ? "apply" : "dry run"}`);
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    console.log(`Database host: ${new URL(databaseUrl).host}`);
  }
  console.log("");

  const trophies = await prisma.trophy.findMany({
    select: {
      id: true,
      userId: true,
      createdAt: true,
      game: {
        select: {
          id: true,
          gameFamilyId: true,
          releaseDate: true,
          createdAt: true,
          platform: { select: { name: true } },
          gameFamily: { select: { title: true } },
        },
      },
    },
  });

  const groups = new Map<string, typeof trophies>();
  for (const trophy of trophies) {
    if (!trophy.game.gameFamilyId) continue;
    const key = `${trophy.userId}:${trophy.game.gameFamilyId}`;
    const group = groups.get(key);
    if (group) {
      group.push(trophy);
    } else {
      groups.set(key, [trophy]);
    }
  }

  const duplicateGroups = Array.from(groups.values()).filter((group) => group.length > 1);
  const affectedUserIds = Array.from(new Set(duplicateGroups.map((group) => group[0]!.userId)));

  const libraryEntries = await prisma.userGame.findMany({
    where: { userId: { in: affectedUserIds } },
    select: { userId: true, gameId: true },
  });
  const libraryGameIdsByUser = new Map<string, Set<string>>();
  for (const entry of libraryEntries) {
    const gameIds = libraryGameIdsByUser.get(entry.userId) ?? new Set<string>();
    gameIds.add(entry.gameId);
    libraryGameIdsByUser.set(entry.userId, gameIds);
  }

  const deleteIds: string[] = [];
  for (const group of duplicateGroups) {
    const userId = group[0]!.userId;
    const libraryGameIds = libraryGameIdsByUser.get(userId) ?? new Set<string>();
    const keepGameIds = new Set(
      pickTrophyGames(
        group.map((trophy) => trophy.game),
        libraryGameIds
      ).map((game) => game.id)
    );

    const kept = group.filter((trophy) => keepGameIds.has(trophy.game.id));
    const removed = group.filter((trophy) => !keepGameIds.has(trophy.game.id));
    deleteIds.push(...removed.map((trophy) => trophy.id));

    const platformList = (rows: typeof group) =>
      rows.map((trophy) => trophy.game.platform?.name ?? "no platform").join(", ");
    const reason = kept.some((trophy) => libraryGameIds.has(trophy.game.id))
      ? "library"
      : "earliest release";
    console.log(
      `user ${userId} - ${group[0]!.game.gameFamily?.title ?? "untitled family"}: ` +
        `keep [${platformList(kept)}] (${reason}), delete [${platformList(removed)}]`
    );
  }

  console.log("");
  console.log(`Trophy rows: ${trophies.length}`);
  console.log(`(user, family) pairs: ${groups.size}`);
  console.log(`Pairs with more than one trophy: ${duplicateGroups.length}`);
  console.log(`Users affected: ${affectedUserIds.length}`);
  console.log(`Rows to delete: ${deleteIds.length}`);
  console.log(`Trophy rows after cleanup: ${trophies.length - deleteIds.length}`);

  if (!apply) {
    console.log("\n[DRY RUN] Nothing was deleted. Run with --apply to delete.");
    return;
  }

  if (deleteIds.length === 0) {
    console.log("\nNothing to delete.");
    return;
  }

  const deleted = await prisma.$transaction(async (tx) => {
    let count = 0;
    for (let i = 0; i < deleteIds.length; i += DELETE_BATCH_SIZE) {
      const result = await tx.trophy.deleteMany({
        where: { id: { in: deleteIds.slice(i, i + DELETE_BATCH_SIZE) } },
      });
      count += result.count;
    }
    return count;
  });

  console.log(`\nDeleted ${deleted} trophy rows.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
