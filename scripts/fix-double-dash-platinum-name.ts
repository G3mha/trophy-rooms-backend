/**
 * Rename Mario Kart: Double Dash!!'s Platinum from "Retro Mastery".
 *
 * Every other Platinum is named after its game. This one kept the generic
 * name it was imported with. "Perfect Partners" comes from the game's
 * two-racer karts and the list's "Partners in ..." perfect-score trophies.
 *
 *   npx tsx scripts/fix-double-dash-platinum-name.ts          # dry run
 *   npx tsx scripts/fix-double-dash-platinum-name.ts --apply
 */

import { AchievementTier, PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile?.();
} catch {
  // Ignore missing env file in deployed environments.
}

const prisma = new PrismaClient();

const FAMILY_SLUG = "mario-kart-double-dash";
const OLD_TITLE = "Retro Mastery";
const NEW_TITLE = "Perfect Partners";

async function main() {
  const apply = process.argv.includes("--apply");

  const inFamily = { achievementSet: { gameFamily: { slug: FAMILY_SLUG } } };
  const platinum = await prisma.achievement.findFirst({
    where: { ...inFamily, tier: AchievementTier.PLATINUM, title: OLD_TITLE },
    select: { id: true, achievementSetId: true },
  });
  if (!platinum) {
    console.log(`No Platinum named "${OLD_TITLE}" on ${FAMILY_SLUG}. Nothing to do.`);
    return;
  }

  // Titles are unique within a list
  const clash = await prisma.achievement.findFirst({
    where: { achievementSetId: platinum.achievementSetId, title: NEW_TITLE },
    select: { id: true },
  });
  if (clash) throw new Error(`"${NEW_TITLE}" is already a trophy in this list`);

  if (apply) {
    await prisma.achievement.update({ where: { id: platinum.id }, data: { title: NEW_TITLE } });
  }
  console.log(`${apply ? "DONE" : "PLAN"}  "${OLD_TITLE}" -> "${NEW_TITLE}"`);
  if (!apply) console.log("Dry run. Pass --apply to write.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
