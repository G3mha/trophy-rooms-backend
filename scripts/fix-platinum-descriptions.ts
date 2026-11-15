/**
 * Give each Platinum a description that says what finishing the list takes.
 *
 * The Platinums added by import-platinum-capstones.ts all read "Complete
 * every achievement for <game>". The replacements live in
 * data/platinum-descriptions.json, keyed by game family slug, and each one
 * was written from that game's own list.
 *
 * Only the description changes. A family is skipped, with a warning, when it
 * doesn't have exactly one Platinum.
 *
 *   npx tsx scripts/fix-platinum-descriptions.ts          # dry run
 *   npx tsx scripts/fix-platinum-descriptions.ts --apply
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
  const descriptions = JSON.parse(
    readFileSync(fileURLToPath(new URL("./data/platinum-descriptions.json", import.meta.url)), "utf8")
  ) as Record<string, string>;

  for (const [slug, description] of Object.entries(descriptions)) {
    assert(description.length <= 150, `${slug}: ${description.length} characters, over 150`);
    assert(!/achievement|—|;/i.test(description), `${slug}: uses a banned word or mark`);
  }

  let changed = 0;
  let skipped = 0;
  for (const [slug, description] of Object.entries(descriptions)) {
    const platinums = await prisma.achievement.findMany({
      where: { tier: AchievementTier.PLATINUM, achievementSet: { gameFamily: { slug } } },
      select: { id: true, title: true, description: true },
    });
    if (platinums.length !== 1) {
      console.warn(`SKIP  ${slug}: ${platinums.length} Platinums`);
      skipped++;
      continue;
    }

    const [platinum] = platinums;
    if (platinum.description === description) continue;

    if (apply) {
      await prisma.achievement.update({ where: { id: platinum.id }, data: { description } });
    }
    console.log(`${apply ? "DONE" : "PLAN"}  ${slug} "${platinum.title}"\n      ${description}`);
    changed++;
  }

  const total = Object.keys(descriptions).length;
  console.log(`\n${total} descriptions, ${changed} ${apply ? "written" : "to write"}, ${skipped} skipped.`);
  if (!apply) console.log("Dry run. Pass --apply to write.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
