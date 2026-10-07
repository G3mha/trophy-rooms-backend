/**
 * Merge families an import created for a game the catalog already had.
 *
 * IGDB sometimes lists one release twice: a Switch port under its own entry,
 * dated years after the PC original whose family the catalog already has
 * (Monomals, Pocket Pool). Until import-platform-region.ts skipped
 * same-titled games released on a platform within 45 days of each other, it
 * gave those a second family. This finds families created after --since with
 * an edition that has a same-titled edition on the same platform, in an older
 * family, released within 45 days of it.
 *
 * Each such edition is a duplicate and is deleted. The family's other
 * editions move to the older family, which has none on their platforms. A
 * family is left alone and reported when its duplicates point at different
 * older families, when the older family already has an edition on one of its
 * other platforms, or when anything uses it (library, collection, trophies,
 * play sessions, buylist, achievement sets, DLC, bundles). Emptied families
 * are deleted. Everything is checked again inside the transaction.
 *
 * Usage:
 *   npx tsx scripts/fix-imported-duplicates.ts --since <ISO time>           # dry run, prints the plan
 *   npx tsx scripts/fix-imported-duplicates.ts --since <ISO time> --apply   # merges, in one transaction
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { normalizeForSearch } from "../src/lib/normalize-search.js";

const prisma = new PrismaClient();

const SAME_RELEASE_MS = 45 * 24 * 60 * 60 * 1000;

// As import-platform-region.ts compares titles
function normalizeTitle(title: string): string {
  return normalizeForSearch(title.replace(/&/g, " and ")) || title.trim().toLowerCase();
}

interface Merge {
  familyId: string;
  targetId: string;
  deleteGames: string[];
  moveGames: string[];
}

async function buildPlan(db: Prisma.TransactionClient, since: Date): Promise<{ merges: Merge[]; problems: string[] }> {
  const families = await db.gameFamily.findMany({
    where: { createdAt: { gte: since } },
    select: {
      id: true,
      slug: true,
      title: true,
      _count: {
        select: { achievementSets: true, dlcs: true, bundles: true, buylistItems: true, baseGameFamilies: true, derivedGameFamilies: true },
      },
      games: {
        select: {
          id: true,
          platformId: true,
          releaseDate: true,
          platform: { select: { name: true } },
          _count: { select: { userGames: true, collectionItems: true, trophies: true, playSessions: true, buylistItems: true } },
        },
      },
    },
    orderBy: { slug: "asc" },
  });

  const olderGames = await db.game.findMany({
    where: { gameFamily: { createdAt: { lt: since } } },
    select: { platformId: true, releaseDate: true, gameFamilyId: true, gameFamily: { select: { slug: true, title: true } } },
  });
  const olderByPlatformTitle = new Map<string, typeof olderGames>();
  const olderPlatformsByFamily = new Map<string, Set<string>>();
  for (const game of olderGames) {
    if (!game.gameFamily || !game.gameFamilyId || !game.platformId) continue;
    const key = `${game.platformId}|${normalizeTitle(game.gameFamily.title)}`;
    olderByPlatformTitle.set(key, [...(olderByPlatformTitle.get(key) ?? []), game]);
    olderPlatformsByFamily.set(game.gameFamilyId, (olderPlatformsByFamily.get(game.gameFamilyId) ?? new Set()).add(game.platformId));
  }

  const merges: Merge[] = [];
  const problems: string[] = [];
  for (const family of families) {
    const duplicates: Array<{ game: (typeof family.games)[number]; targetId: string; targetSlug: string }> = [];
    const others: typeof family.games = [];
    for (const game of family.games) {
      const match = (olderByPlatformTitle.get(`${game.platformId}|${normalizeTitle(family.title)}`) ?? []).find(
        (older) =>
          older.releaseDate !== null &&
          game.releaseDate !== null &&
          Math.abs(older.releaseDate.getTime() - game.releaseDate.getTime()) <= SAME_RELEASE_MS
      );
      if (match) duplicates.push({ game, targetId: match.gameFamilyId!, targetSlug: match.gameFamily!.slug });
      else others.push(game);
    }
    if (duplicates.length === 0) continue;

    const targets = new Set(duplicates.map((duplicate) => duplicate.targetId));
    const target = duplicates[0]!;
    const targetPlatforms = olderPlatformsByFamily.get(target.targetId) ?? new Set();
    const used = [...duplicates.map((duplicate) => duplicate.game), ...others].filter((game) =>
      Object.values(game._count).some((count) => count > 0)
    );
    const blocked = others.filter((game) => targetPlatforms.has(game.platformId!));
    if (targets.size > 1) {
      problems.push(`${family.slug}: duplicates editions in ${[...new Set(duplicates.map((d) => d.targetSlug))].join(", ")}`);
    } else if (Object.values(family._count).some((count) => count > 0) || used.length > 0) {
      problems.push(`${family.slug}: something uses it`);
    } else if (blocked.length > 0) {
      problems.push(
        `${family.slug}: ${target.targetSlug} already has ${blocked.map((game) => game.platform?.name).join(", ")} at another date`
      );
    } else {
      for (const { game } of duplicates) {
        console.log(`  ${family.slug}: delete ${game.platform?.name} (${target.targetSlug} has it)`);
      }
      for (const game of others) {
        console.log(`  ${family.slug}: move ${game.platform?.name} to ${target.targetSlug}`);
      }
      console.log(`  ${family.slug}: delete the family`);
      merges.push({
        familyId: family.id,
        targetId: target.targetId,
        deleteGames: duplicates.map((duplicate) => duplicate.game.id),
        moveGames: others.map((game) => game.id),
      });
    }
  }
  return { merges, problems };
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const sinceIndex = args.indexOf("--since");
  const since = sinceIndex >= 0 && args[sinceIndex + 1] ? new Date(args[sinceIndex + 1]!) : undefined;
  if (!since || Number.isNaN(since.getTime())) {
    console.error("Usage: npx tsx scripts/fix-imported-duplicates.ts --since <ISO time> [--apply]");
    process.exitCode = 1;
    return;
  }

  console.log("=== Fix Imported Duplicates ===\n");
  console.log(`Mode: ${apply ? "apply" : "dry run"}`);
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    console.log(`Database host: ${new URL(databaseUrl).host}`);
  }
  console.log(`Families created since: ${since.toISOString()}`);
  console.log("");

  const run = async (db: Prisma.TransactionClient) => {
    const plan = await buildPlan(db, since);
    console.log(`\nFamilies to merge: ${plan.merges.length}`);
    console.log(`Editions to delete: ${plan.merges.reduce((sum, merge) => sum + merge.deleteGames.length, 0)}`);
    console.log(`Editions to move: ${plan.merges.reduce((sum, merge) => sum + merge.moveGames.length, 0)}`);
    if (plan.problems.length > 0) {
      console.log(`Left alone (${plan.problems.length}):`);
      for (const problem of plan.problems) console.log(`  ${problem}`);
    }
    return plan.merges;
  };

  if (!apply) {
    await run(prisma);
    console.log("\n[DRY RUN] Nothing was merged. Run with --apply to merge.");
    return;
  }

  const merged = await prisma.$transaction(
    async (tx) => {
      const merges = await run(tx);
      for (const merge of merges) {
        const deleted = await tx.game.deleteMany({ where: { id: { in: merge.deleteGames }, gameFamilyId: merge.familyId } });
        const moved = await tx.game.updateMany({
          where: { id: { in: merge.moveGames }, gameFamilyId: merge.familyId },
          data: { gameFamilyId: merge.targetId },
        });
        const family = await tx.gameFamily.deleteMany({ where: { id: merge.familyId, games: { none: {} } } });
        if (deleted.count !== merge.deleteGames.length || moved.count !== merge.moveGames.length || family.count !== 1) {
          throw new Error(`Family ${merge.familyId} changed while merging. Rolled back.`);
        }
      }
      return merges.length;
    },
    { timeout: 120_000 }
  );

  console.log(`\nMerged ${merged} families.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
