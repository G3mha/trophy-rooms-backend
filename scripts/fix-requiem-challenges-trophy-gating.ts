/**
 * Stop Resident Evil Requiem's in-game Challenges from gating its trophy.
 *
 * The family carries both of the game's real lists: the 50 PSN trophies and
 * the 50 in-game Challenges. Forty-nine of the challenges are the trophies
 * under the same titles, so with both sets counting, the family's trophy
 * asked for 100 ticks covering 51 distinct accomplishments, and a player who
 * had genuinely earned the Platinum read 50%.
 *
 * Clearing countsTowardTrophy on the Challenges set makes the PSN list the
 * one that defines finishing the game, which is what its Platinum ("Obtain
 * all trophies") already means. The Challenges set stays visible and
 * tickable; it just no longer raises the bar. The one challenge with no
 * trophy behind it, The Final Puzzle, becomes optional as a result.
 *
 * Touches one boolean on one set. No achievements or user data are deleted,
 * and lowering the bar never revokes a trophy someone already holds.
 */

import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile?.();
} catch {
  // Ignore missing env file in deployed environments.
}

const prisma = new PrismaClient();

const FAMILY_TITLE = "Resident Evil Requiem";
const NON_GATING_SET_TITLE = "In-Game Challenges";
const GATING_SET_TITLE = "PSN Achievement Set";

async function main() {
  const family = await prisma.gameFamily.findFirstOrThrow({
    where: { title: FAMILY_TITLE },
    select: {
      id: true,
      title: true,
      achievementSets: {
        select: {
          id: true,
          title: true,
          countsTowardTrophy: true,
          _count: { select: { achievements: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const target = family.achievementSets.find((set) => set.title === NON_GATING_SET_TITLE);

  if (!target) {
    throw new Error(`No "${NON_GATING_SET_TITLE}" set on ${family.title}`);
  }

  if (!family.achievementSets.some((set) => set.title === GATING_SET_TITLE)) {
    throw new Error(
      `No "${GATING_SET_TITLE}" to carry the gating, refusing to leave ${family.title} with none`
    );
  }

  // Ticks already recorded inside the set are kept; they simply stop counting.
  const ticked = await prisma.userAchievement.count({
    where: { achievement: { achievementSetId: target.id } },
  });

  console.log(`${family.title}: before`);
  for (const set of family.achievementSets) {
    console.log(
      `  "${set.title}" ${set._count.achievements} achievements, ` +
        `countsTowardTrophy=${set.countsTowardTrophy}`
    );
  }
  if (ticked > 0) {
    console.log(`  note: ${ticked} user tick(s) in "${target.title}" stay, but stop counting`);
  }

  if (target.countsTowardTrophy) {
    await prisma.achievementSet.update({
      where: { id: target.id },
      data: { countsTowardTrophy: false },
    });
    console.log(`\nCleared countsTowardTrophy on "${target.title}"`);
  } else {
    console.log(`\n"${target.title}" already does not count, nothing to do`);
  }

  const gating = await prisma.achievement.aggregate({
    where: {
      achievementSet: { gameFamilyId: family.id, countsTowardTrophy: true },
    },
    _count: { id: true },
    _sum: { points: true },
  });

  console.log(
    `${family.title} trophy now needs ${gating._count.id} achievements ` +
      `worth ${gating._sum.points ?? 0} points`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
