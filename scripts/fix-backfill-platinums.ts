/**
 * Give the Platinum to players who had already finished a game's list.
 *
 * The trophy and its Platinum are awarded when a player ticks something
 * (awardTrophyIfComplete in src/lib/trophies.ts). A player who had every
 * trophy ticked before the list got its Platinum, or before a list was
 * trimmed down to what they had, never ticks again, so they were left
 * without it.
 *
 * For each player who has every counting trophy in a family, this runs the
 * same award the app runs. Rows it creates are dated to the player's last
 * tick in that family, since that is when they finished. Nothing is ever
 * removed, and a player who isn't finished is left alone.
 *
 *   npx tsx scripts/fix-backfill-platinums.ts          # dry run
 *   npx tsx scripts/fix-backfill-platinums.ts --apply
 */

import { AchievementTier, PrismaClient } from "@prisma/client";
import { awardTrophyIfComplete, notPlatinum, trophyEligibleSetWhere } from "../src/lib/trophies.js";

try {
  process.loadEnvFile?.();
} catch {
  // Ignore missing env file in deployed environments.
}

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");

  const families = await prisma.gameFamily.findMany({
    where: { achievementSets: { some: trophyEligibleSetWhere } },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  let awarded = 0;
  for (const family of families) {
    const eligibleSet = { gameFamilyId: family.id, ...trophyEligibleSetWhere };
    const total = await prisma.achievement.count({ where: { ...notPlatinum, achievementSet: eligibleSet } });
    if (total === 0) continue;

    const ticks = await prisma.userAchievement.groupBy({
      by: ["userId"],
      where: { achievement: { ...notPlatinum, achievementSet: eligibleSet } },
      _count: { _all: true },
      _max: { createdAt: true },
    });
    const platinumIds = (
      await prisma.achievement.findMany({
        where: { tier: AchievementTier.PLATINUM, achievementSet: eligibleSet },
        select: { id: true },
      })
    ).map((achievement) => achievement.id);

    for (const tick of ticks) {
      if (tick._count._all < total) continue;
      const userId = tick.userId;

      const trophiesBefore = await prisma.trophy.findMany({
        where: { userId, game: { gameFamilyId: family.id } },
        select: { id: true },
      });
      const platinumsBefore = await prisma.userAchievement.findMany({
        where: { userId, achievementId: { in: platinumIds } },
        select: { id: true },
      });
      const missingTrophy = trophiesBefore.length === 0;
      const missingPlatinum = platinumsBefore.length < platinumIds.length;
      if (!missingTrophy && !missingPlatinum) continue;

      const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      const what = [missingTrophy && "trophy", missingPlatinum && "Platinum"].filter(Boolean).join(" and ");
      console.log(`${apply ? "DONE" : "PLAN"}  ${family.title}: ${user?.name ?? userId} gets the ${what}`);
      awarded++;
      if (!apply) continue;

      await awardTrophyIfComplete(prisma, userId, family.id);

      // Date the new rows to when the player finished, not to this run
      const finishedAt = tick._max.createdAt;
      if (!finishedAt) continue;
      await prisma.trophy.updateMany({
        where: {
          userId,
          game: { gameFamilyId: family.id },
          id: { notIn: trophiesBefore.map((trophy) => trophy.id) },
        },
        data: { createdAt: finishedAt },
      });
      await prisma.userAchievement.updateMany({
        where: {
          userId,
          achievementId: { in: platinumIds },
          id: { notIn: platinumsBefore.map((row) => row.id) },
        },
        data: { createdAt: finishedAt },
      });
    }
  }

  console.log(`\n${families.length} games checked, ${awarded} ${apply ? "awarded" : "to award"}.`);
  if (!apply) console.log("Dry run. Pass --apply to write.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
