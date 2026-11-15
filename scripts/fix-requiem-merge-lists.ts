/**
 * Merge Resident Evil Requiem's In-Game Challenges into its main list.
 *
 * The game has one trophy list regardless of platform. 49 of the 50 in-game
 * challenges are the PSN trophies under the same titles, so they are already
 * in the main list. The one that isn't ("The Final Puzzle") moves over, and
 * the trophy then asks for it too.
 *
 * No accomplishment is dropped. A challenge is only removed when the main
 * list has an achievement with the same title and nobody has ticked the copy;
 * anything else moves. The emptied list is then removed.
 *
 * Don't rerun import-resident-evil-requiem-challenges.ts afterwards: it would
 * create the second list again.
 *
 *   npx tsx scripts/fix-requiem-merge-lists.ts          # dry run
 *   npx tsx scripts/fix-requiem-merge-lists.ts --apply
 */

import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile?.();
} catch {
  // Ignore missing env file in deployed environments.
}

const prisma = new PrismaClient();

const FAMILY_SLUG = "resident-evil-requiem";
const MAIN_SET = "PSN Trophy List";
const MERGED_SET = "In-Game Challenges";

const normalize = (title: string) => title.toLowerCase().replace(/[^a-z0-9]/g, "");

async function main() {
  const apply = process.argv.includes("--apply");
  const say = (action: string) => console.log(`${apply ? "DONE" : "PLAN"}  ${action}`);

  const sets = await prisma.achievementSet.findMany({
    where: { gameFamily: { slug: FAMILY_SLUG }, title: { in: [MAIN_SET, MERGED_SET] } },
    include: { achievements: { include: { _count: { select: { users: true } } } } },
  });
  const main = sets.find((set) => set.title === MAIN_SET);
  const merged = sets.find((set) => set.title === MERGED_SET);
  if (!main) throw new Error(`No "${MAIN_SET}" on ${FAMILY_SLUG}`);
  if (!merged) {
    console.log(`No "${MERGED_SET}" left. Nothing to do.`);
    return;
  }

  const mainTitles = new Set(main.achievements.map((achievement) => normalize(achievement.title)));
  const duplicates = merged.achievements.filter(
    (achievement) => mainTitles.has(normalize(achievement.title)) && achievement._count.users === 0
  );
  const toMove = merged.achievements.filter((achievement) => !duplicates.includes(achievement));

  for (const achievement of toMove) {
    if (mainTitles.has(normalize(achievement.title))) {
      // A ticked copy: moving it would clash with the title already there
      throw new Error(`"${achievement.title}" is a copy with player ticks. Merge the ticks by hand first.`);
    }
    say(`move "${achievement.title}" to "${MAIN_SET}"`);
    if (apply) {
      await prisma.achievement.update({ where: { id: achievement.id }, data: { achievementSetId: main.id } });
    }
  }

  say(`remove "${MERGED_SET}" and its ${duplicates.length} copies of achievements already in "${MAIN_SET}"`);
  if (apply) {
    const left = await prisma.achievement.count({
      where: { achievementSetId: merged.id, id: { notIn: duplicates.map((achievement) => achievement.id) } },
    });
    if (left > 0) throw new Error(`${left} achievements would be lost. Nothing removed.`);
    await prisma.achievementSet.delete({ where: { id: merged.id } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
