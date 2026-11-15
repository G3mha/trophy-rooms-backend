/**
 * Give Resident Evil Requiem's "The Final Puzzle" an icon.
 *
 * The Final Puzzle is the one in-game challenge that is not a PSN or Steam
 * trophy, so no official trophy icon exists for it and
 * populate-achievement-icons.ts can never match it. This one is made to sit
 * with the others: an official screenshot (IGDB sc10tnw, the hand scans) in
 * gray inside the ring and flourish taken from the game's own silver trophy
 * icons, hosted on assets.trophyrooms.org.
 *
 * Only fills the icon while it is empty.
 *
 *   npx tsx scripts/fix-requiem-final-puzzle-icon.ts          # dry run
 *   npx tsx scripts/fix-requiem-final-puzzle-icon.ts --apply
 */

import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile?.();
} catch {
  // Ignore missing env file in deployed environments.
}

const prisma = new PrismaClient();

const ICON_URL =
  "https://assets.trophyrooms.org/achievements/resident-evil-requiem/the-final-puzzle-c7033c4b.webp";

async function main() {
  const apply = process.argv.includes("--apply");

  const response = await fetch(ICON_URL, { method: "HEAD" });
  assert(response.ok, `${ICON_URL} answered ${response.status}`);

  const matches = await prisma.achievement.findMany({
    where: { title: "The Final Puzzle", achievementSet: { gameFamily: { slug: "resident-evil-requiem" } } },
    select: { id: true, iconUrl: true },
  });
  assert.equal(matches.length, 1, `expected one "The Final Puzzle", found ${matches.length}`);

  const [trophy] = matches;
  if (trophy.iconUrl) {
    console.log(`Already has an icon: ${trophy.iconUrl}`);
    return;
  }

  if (apply) {
    await prisma.achievement.update({ where: { id: trophy.id }, data: { iconUrl: ICON_URL } });
  }
  console.log(`${apply ? "DONE" : "PLAN"}  The Final Puzzle -> ${ICON_URL}`);
  if (!apply) console.log("Dry run. Pass --apply to write.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
