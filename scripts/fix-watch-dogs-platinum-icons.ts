/**
 * Replace the cup-shaped Platinum icons of Watch Dogs and Watch Dogs 2.
 *
 * PSN's own Platinum icon for both games is a plain trophy cup drawn in the
 * game's icon style. These swap the cup for the series' fox emblem, drawn the
 * way each game draws its other trophies: white line work inside a wire ring
 * for Watch Dogs, a dot matrix inside the dotted ring for Watch Dogs 2. The
 * emblem is traced from the official "magnifier" trophy icon, and each
 * background is what the game's own icons share. Hosted on
 * assets.trophyrooms.org.
 *
 * An icon is only replaced while it is still the official cup, so a later
 * hand edit is never overwritten. The cup files stay in the bucket, so
 * putting FROM back restores them.
 *
 *   npx tsx scripts/fix-watch-dogs-platinum-icons.ts          # dry run
 *   npx tsx scripts/fix-watch-dogs-platinum-icons.ts --apply
 */

import assert from "node:assert/strict";
import { AchievementTier, PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile?.();
} catch {
  // Ignore missing env file in deployed environments.
}

const prisma = new PrismaClient();

const BASE = "https://assets.trophyrooms.org/achievements/";

const FIXES = [
  { slug: "watch-dogs", from: "watch-dogs/100-clear-bcc39bdf.webp", to: "watch-dogs/100-clear-ae406fa6.webp" },
  {
    slug: "watch-dogs-2",
    from: "watch-dogs-2/graduation-day-19845696.webp",
    to: "watch-dogs-2/graduation-day-0ed66eb0.webp",
  },
];

async function main() {
  const apply = process.argv.includes("--apply");

  for (const fix of FIXES) {
    const response = await fetch(BASE + fix.to, { method: "HEAD" });
    assert(response.ok, `${BASE + fix.to} answered ${response.status}`);

    const where = {
      tier: AchievementTier.PLATINUM,
      iconUrl: BASE + fix.from,
      achievementSet: { gameFamily: { slug: fix.slug } },
    };
    const count = apply
      ? (await prisma.achievement.updateMany({ where, data: { iconUrl: BASE + fix.to } })).count
      : await prisma.achievement.count({ where });
    console.log(`${count === 0 ? "SKIP" : apply ? "DONE" : "PLAN"}  ${fix.slug} -> ${BASE + fix.to}`);
  }

  if (!apply) console.log("Dry run. Pass --apply to write.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
