/**
 * New Super Mario Bros. keeps one trophy list: the RetroAchievements one.
 *
 * It had two gating lists covering the same ground (a 30-achievement house
 * list and the 112-achievement RetroAchievements list), so the trophy needed
 * 142 ticks. This moves the Platinum ("Plumber Supreme") onto the kept list
 * and stops the house list gating. Both steps are reversible.
 *
 * --delete-house-list then removes the house list for good. It first writes
 * the list and any player ticks on it to data/nsmb-house-list-backup.json.
 *
 *   npx tsx scripts/fix-nsmb-single-list.ts                       # dry run
 *   npx tsx scripts/fix-nsmb-single-list.ts --apply
 *   npx tsx scripts/fix-nsmb-single-list.ts --apply --delete-house-list
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AchievementTier, PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile?.();
} catch {
  // Ignore missing env file in deployed environments.
}

const prisma = new PrismaClient();

const FAMILY_SLUG = "new-super-mario-bros";
const HOUSE_SET = "Base Achievement Set";
const KEPT_SET = "RetroAchievements list";

async function main() {
  const apply = process.argv.includes("--apply");
  const deleteHouseList = process.argv.includes("--delete-house-list");
  const say = (action: string) => console.log(`${apply ? "DONE" : "PLAN"}  ${action}`);

  const sets = await prisma.achievementSet.findMany({
    where: { gameFamily: { slug: FAMILY_SLUG }, title: { in: [HOUSE_SET, KEPT_SET] } },
    include: {
      achievements: {
        orderBy: { createdAt: "asc" },
        include: { users: { select: { userId: true, createdAt: true } } },
      },
    },
  });
  const kept = sets.find((set) => set.title === KEPT_SET);
  const house = sets.find((set) => set.title === HOUSE_SET);
  if (!kept) throw new Error(`No "${KEPT_SET}" on ${FAMILY_SLUG}`);
  if (!house) {
    console.log(`No "${HOUSE_SET}" left. Nothing to do.`);
    return;
  }

  const platinum = house.achievements.find((achievement) => achievement.tier === AchievementTier.PLATINUM);
  if (platinum && !kept.achievements.some((achievement) => achievement.tier === AchievementTier.PLATINUM)) {
    say(`move "${platinum.title}" to "${KEPT_SET}"`);
    if (apply) {
      await prisma.achievement.update({ where: { id: platinum.id }, data: { achievementSetId: kept.id } });
    }
  }

  if (house.countsTowardTrophy) {
    say(`stop "${HOUSE_SET}" gating the trophy`);
    if (apply) {
      await prisma.achievementSet.update({ where: { id: house.id }, data: { countsTowardTrophy: false } });
    }
  }

  if (!deleteHouseList) return;

  const remaining = house.achievements.filter((achievement) => achievement.id !== platinum?.id);
  const ticks = remaining.reduce((sum, achievement) => sum + achievement.users.length, 0);
  say(`delete "${HOUSE_SET}": ${remaining.length} achievements, ${ticks} player ticks`);
  if (apply) {
    const backup = fileURLToPath(new URL("./data/nsmb-house-list-backup.json", import.meta.url));
    writeFileSync(
      backup,
      JSON.stringify(
        {
          set: { title: house.title, type: house.type, visibility: house.visibility },
          achievements: remaining.map((achievement) => ({
            title: achievement.title,
            description: achievement.description,
            tier: achievement.tier,
            ticks: achievement.users,
          })),
        },
        null,
        2
      ) + "\n"
    );
    console.log(`      backup written to ${backup}`);
    await prisma.achievementSet.delete({ where: { id: house.id } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
