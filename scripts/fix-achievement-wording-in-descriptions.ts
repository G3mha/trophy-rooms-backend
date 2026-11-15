/**
 * Reword the trophy descriptions that still say "achievement".
 *
 * These came over from RetroAchievements with notes about how its emulator
 * unlocks them. Players tick trophies by hand here, so "will unlock at
 * credits" means nothing and goes. The Order of Ecclesia note on how to retry
 * is still useful, so it stays in plain words (and loses its "trough" typo).
 *
 * A description is only rewritten while it still has the old text, so a
 * later hand edit is never overwritten.
 *
 *   npx tsx scripts/fix-achievement-wording-in-descriptions.ts          # dry run
 *   npx tsx scripts/fix-achievement-wording-in-descriptions.ts --apply
 */

import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile?.();
} catch {
  // Ignore missing env file in deployed environments.
}

const prisma = new PrismaClient();

const MAJORA_FROM = "Defeat Majora without taking damage or using any masks - achievement will unlock at credits.";
const MAJORA_TO = "Defeat Majora without taking damage or using any masks.";

const FIXES = [
  {
    slug: "castlevania-order-of-ecclesia",
    title: "Perfect Training Hall",
    from: "Pass trough Training Hall without taking damage as Shanoa [You must leave Training Hall and come back to reset this achievement]",
    to: "Pass through the Training Hall without taking damage as Shanoa. To try again, leave the Training Hall and come back.",
  },
  { slug: "the-legend-of-zelda-majora-s-mask", title: "Flawless Curse-Breaker", from: MAJORA_FROM, to: MAJORA_TO },
  { slug: "the-legend-of-zelda-majoras-mask-3d", title: "Flawless Curse-Breaker", from: MAJORA_FROM, to: MAJORA_TO },
];

for (const fix of FIXES) {
  assert(!/achievement|—|;/i.test(fix.to), `${fix.title}: uses a banned word or mark`);
}

async function main() {
  const apply = process.argv.includes("--apply");

  let changed = 0;
  for (const fix of FIXES) {
    const { count } = apply
      ? await prisma.achievement.updateMany({
          where: { title: fix.title, description: fix.from, achievementSet: { gameFamily: { slug: fix.slug } } },
          data: { description: fix.to },
        })
      : { count: await prisma.achievement.count({
          where: { title: fix.title, description: fix.from, achievementSet: { gameFamily: { slug: fix.slug } } },
        }) };
    if (count === 0) continue;
    console.log(`${apply ? "DONE" : "PLAN"}  ${fix.slug} "${fix.title}"\n      ${fix.to}`);
    changed += count;
  }

  const left = await prisma.achievement.count({
    where: {
      OR: [
        { title: { contains: "achievement", mode: "insensitive" } },
        { description: { contains: "achievement", mode: "insensitive" } },
      ],
    },
  });
  console.log(`\n${changed} ${apply ? "rewritten" : "to rewrite"}. ${left} trophies mention "achievement" now.`);
  if (!apply) console.log("Dry run. Pass --apply to write.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
