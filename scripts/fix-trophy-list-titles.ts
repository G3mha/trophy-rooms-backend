/**
 * Rename lists whose title still says "achievement".
 *
 * The apps call every list item a trophy and every list a trophy list, but
 * list titles are data, so names like "PSN Achievement Set" kept the old
 * word. "RetroAchievements" is a brand name and stays.
 *
 * A rename is skipped when the family already has a list with the new title,
 * type and creator, since that would break the unique key.
 *
 * The scripts that look these lists up by title use the new title too.
 *
 *   npx tsx scripts/fix-trophy-list-titles.ts          # dry run
 *   npx tsx scripts/fix-trophy-list-titles.ts --apply
 */

import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile?.();
} catch {
  // Ignore missing env file in deployed environments.
}

const prisma = new PrismaClient();

export function renameTitle(title: string): string {
  return title
    .replace(/\bAchievement Sets?\b/g, (match) => (match.endsWith("s") ? "Trophy Lists" : "Trophy List"))
    .replace(/\bachievement sets?\b/g, (match) => (match.endsWith("s") ? "trophy lists" : "trophy list"))
    .replace(/\bAchievements\b/g, "Trophies")
    .replace(/\bachievements\b/g, "trophies")
    .replace(/\bAchievement\b/g, "Trophy")
    .replace(/\bachievement\b/g, "trophy");
}

assert.equal(renameTitle("PSN Achievement Set"), "PSN Trophy List");
assert.equal(renameTitle("Main Achievements"), "Main Trophies");
assert.equal(renameTitle("RetroAchievements"), "RetroAchievements");
assert.equal(renameTitle("RetroAchievements Achievement Set"), "RetroAchievements Trophy List");
assert.equal(renameTitle("In-Game Challenges"), "In-Game Challenges");

async function main() {
  const apply = process.argv.includes("--apply");

  const sets = await prisma.achievementSet.findMany({
    select: {
      id: true,
      title: true,
      type: true,
      createdByUserId: true,
      gameFamilyId: true,
      gameFamily: { select: { title: true } },
    },
    orderBy: [{ title: "asc" }],
  });

  const key = (set: { gameFamilyId: string | null; title: string; type: string; createdByUserId: string | null }) =>
    [set.gameFamilyId, set.title, set.type, set.createdByUserId].join("|");
  const taken = new Set(sets.map(key));

  let renamed = 0;
  let skipped = 0;
  for (const set of sets) {
    const title = renameTitle(set.title);
    if (title === set.title) continue;

    const family = set.gameFamily?.title ?? "(no family)";
    if (taken.has(key({ ...set, title }))) {
      console.log(`SKIP  ${family}: "${set.title}" -> "${title}" already exists`);
      skipped++;
      continue;
    }

    if (apply) {
      await prisma.achievementSet.update({ where: { id: set.id }, data: { title } });
    }
    taken.add(key({ ...set, title }));
    console.log(`${apply ? "DONE" : "PLAN"}  ${family}: "${set.title}" -> "${title}"`);
    renamed++;
  }

  console.log(`\n${sets.length} lists, ${renamed} ${apply ? "renamed" : "to rename"}, ${skipped} skipped.`);
  if (!apply) console.log("Dry run. Pass --apply to write.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
