/**
 * Remove Platinums left behind in lists that stopped counting for a trophy.
 *
 * A Platinum is derived (src/lib/trophies.ts): awardTrophyIfComplete gives it
 * and unmarkAchievementComplete takes it away, and both only look at lists
 * that count for the game's trophy (trophyEligibleSetWhere). Neither mutation
 * lets a player tick or untick a Platinum by hand. So when a list stops
 * counting after a player earned its Platinum (a fix script clears
 * countsTowardTrophy, or a custom list goes back to private), nothing in the
 * app can remove that Platinum any more.
 *
 * This deletes the UserAchievement rows for Platinum-tier achievements in
 * lists that don't count. Run it after any change that stops a list counting.
 * It never touches Trophy rows, regular ticks, or Platinums in lists that
 * count. If the list counts again later, fix-backfill-platinums.ts gives the
 * Platinum back to the players who are finished.
 *
 * Usage:
 *   npx tsx scripts/fix-stuck-platinums.ts           # dry run, prints the plan
 *   npx tsx scripts/fix-stuck-platinums.ts --apply   # deletes
 */

import { AchievementTier, PrismaClient } from "@prisma/client";
import { trophyEligibleSetWhere } from "../src/lib/trophies.js";

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.slice(2).includes("--apply");

  console.log("=== Fix Stuck Platinums ===\n");
  console.log(`Mode: ${apply ? "apply" : "dry run"}`);
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    console.log(`Database host: ${new URL(databaseUrl).host}`);
  }
  console.log("");

  const stuck = await prisma.userAchievement.findMany({
    where: {
      achievement: {
        tier: AchievementTier.PLATINUM,
        achievementSet: { NOT: trophyEligibleSetWhere },
      },
    },
    select: {
      id: true,
      userId: true,
      achievement: {
        select: {
          title: true,
          achievementSet: { select: { title: true, gameFamily: { select: { title: true } } } },
        },
      },
    },
    orderBy: [{ achievementId: "asc" }, { userId: "asc" }],
  });

  for (const row of stuck) {
    const set = row.achievement.achievementSet;
    console.log(
      `user ${row.userId} - ${set.gameFamily?.title ?? "no game"} / ${set.title}: ` +
        `delete Platinum "${row.achievement.title}"`
    );
  }

  if (stuck.length > 0) console.log("");
  console.log(`Rows to delete: ${stuck.length}`);

  if (!apply) {
    console.log("\n[DRY RUN] Nothing was deleted. Run with --apply to delete.");
    return;
  }

  if (stuck.length === 0) {
    console.log("\nNothing to delete.");
    return;
  }

  // The filter is repeated so a list that started counting again since the
  // read above keeps its Platinums
  const deleted = await prisma.userAchievement.deleteMany({
    where: {
      id: { in: stuck.map((row) => row.id) },
      achievement: {
        tier: AchievementTier.PLATINUM,
        achievementSet: { NOT: trophyEligibleSetWhere },
      },
    },
  });

  console.log(`\nDeleted ${deleted.count} Platinum rows.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
