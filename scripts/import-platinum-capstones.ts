/**
 * Give every trophy list a Platinum: the trophy under the game's own name.
 *
 * The Platinum is derived (see notPlatinum in src/lib/trophies.ts), so adding
 * one changes no player's progress. Names live in data/platinum-capstones.json,
 * keyed by game family slug.
 *
 * Idempotent: a family that already has a Platinum is skipped. A family is
 * also skipped, with a warning, when it doesn't have exactly one gating set
 * (nowhere unambiguous to put it) or when someone already holds its trophy
 * (they would need the new Platinum completed for them).
 *
 *   npx tsx scripts/import-platinum-capstones.ts          # dry run
 *   npx tsx scripts/import-platinum-capstones.ts --apply
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AchievementTier, PrismaClient } from "@prisma/client";
import { trophyEligibleSetWhere } from "../src/lib/trophies.js";

try {
  process.loadEnvFile?.();
} catch {
  // Ignore missing env file in deployed environments.
}

const prisma = new PrismaClient();

type Capstone = { slug: string; title: string; description: string };

async function main() {
  const apply = process.argv.includes("--apply");
  const capstones = JSON.parse(
    readFileSync(fileURLToPath(new URL("./data/platinum-capstones.json", import.meta.url)), "utf8")
  ) as Capstone[];

  let created = 0;
  let skipped = 0;

  for (const capstone of capstones) {
    const family = await prisma.gameFamily.findFirst({
      where: { slug: capstone.slug },
      select: {
        title: true,
        achievementSets: {
          where: trophyEligibleSetWhere,
          select: {
            id: true,
            title: true,
            achievements: { where: { tier: AchievementTier.PLATINUM }, select: { title: true } },
          },
        },
        games: { select: { _count: { select: { trophies: true } } } },
      },
    });

    if (!family) {
      console.log(`SKIP  ${capstone.slug}: no such family`);
      skipped++;
      continue;
    }

    const existing = family.achievementSets.flatMap((set) => set.achievements);
    if (existing.length > 0) {
      console.log(`SKIP  ${family.title}: already has "${existing[0]?.title}"`);
      skipped++;
      continue;
    }

    const [set, ...otherSets] = family.achievementSets;
    if (!set || otherSets.length > 0) {
      console.log(`WARN  ${family.title}: ${family.achievementSets.length} gating sets, expected 1`);
      skipped++;
      continue;
    }

    const trophies = family.games.reduce((sum, game) => sum + game._count.trophies, 0);
    if (trophies > 0) {
      console.log(`WARN  ${family.title}: ${trophies} trophies already awarded, add it by hand`);
      skipped++;
      continue;
    }

    console.log(`${apply ? "ADD " : "PLAN"}  ${family.title}: "${capstone.title}" -> ${set.title}`);
    if (apply) {
      await prisma.achievement.create({
        data: {
          title: capstone.title,
          description: capstone.description,
          tier: AchievementTier.PLATINUM,
          achievementSetId: set.id,
        },
      });
    }
    created++;
  }

  console.log(`\n${created} ${apply ? "added" : "to add"}, ${skipped} skipped.${apply ? "" : " Dry run. Pass --apply to write."}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
