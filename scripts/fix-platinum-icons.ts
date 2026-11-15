/**
 * Give every Platinum that has no icon one.
 *
 * Icons live in data/platinum-icons.json, keyed by game family slug. For a
 * list that came from RetroAchievements the Platinum uses that game's own
 * RetroAchievements icon, the same choice Mario Kart: Double Dash!! already
 * had. Resident Evil Requiem uses its official PSN Platinum icon, flattened
 * onto the gray fade the game's other icons sit on and hosted on
 * assets.trophyrooms.org (Steam ships that list without a Platinum).
 *
 * A Platinum that already has an icon is left alone. Every URL is checked
 * before anything is written, so a dead link can't leave a broken icon.
 *
 *   npx tsx scripts/fix-platinum-icons.ts          # dry run
 *   npx tsx scripts/fix-platinum-icons.ts --apply
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AchievementTier, PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile?.();
} catch {
  // Ignore missing env file in deployed environments.
}

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");
  const icons = JSON.parse(
    readFileSync(fileURLToPath(new URL("./data/platinum-icons.json", import.meta.url)), "utf8")
  ) as Record<string, string>;

  for (const [slug, iconUrl] of Object.entries(icons)) {
    const response = await fetch(iconUrl, { method: "HEAD" });
    assert(response.ok, `${slug}: ${iconUrl} answered ${response.status}`);
    assert(response.headers.get("content-type")?.startsWith("image/"), `${slug}: ${iconUrl} is not an image`);
  }

  let changed = 0;
  let skipped = 0;
  for (const [slug, iconUrl] of Object.entries(icons)) {
    const platinums = await prisma.achievement.findMany({
      where: { tier: AchievementTier.PLATINUM, achievementSet: { gameFamily: { slug } } },
      select: { id: true, title: true, iconUrl: true },
    });
    if (platinums.length !== 1) {
      console.warn(`SKIP  ${slug}: ${platinums.length} Platinums`);
      skipped++;
      continue;
    }

    const [platinum] = platinums;
    if (platinum.iconUrl) continue;

    if (apply) {
      await prisma.achievement.update({ where: { id: platinum.id }, data: { iconUrl } });
    }
    console.log(`${apply ? "DONE" : "PLAN"}  ${slug} "${platinum.title}" -> ${iconUrl}`);
    changed++;
  }

  const total = Object.keys(icons).length;
  console.log(`\n${total} icons, ${changed} ${apply ? "written" : "to write"}, ${skipped} skipped.`);
  if (!apply) console.log("Dry run. Pass --apply to write.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
