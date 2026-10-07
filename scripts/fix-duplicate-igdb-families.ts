/**
 * Merge families that are the same IGDB game.
 *
 * GameFamily.igdbId is unique, so when two families' editions point at the
 * same IGDB game neither could take the id (fix-igdb-ids.ts skips them). That
 * happens when an importer created a second family under a slightly different
 * title or slug ("KlashBall" and "Klash Ball").
 *
 * For each IGDB game whose editions sit in more than one family without an
 * IGDB id, the family created first (then the shorter slug) is kept. Each other family's editions move
 * into it when it has no edition on that platform; an edition on a platform it
 * already has is a duplicate and is deleted, but only when nothing uses it
 * (library, collection, trophies, play sessions, buylist). The kept family
 * then takes the IGDB id and emptied families are deleted. A family with
 * achievement sets, DLC, bundles, buylist entries or base/derived links is
 * left alone and reported, since those need a person to decide.
 *
 * Usage:
 *   npx tsx scripts/fix-duplicate-igdb-families.ts           # dry run, prints the plan
 *   npx tsx scripts/fix-duplicate-igdb-families.ts --apply   # merges, in one transaction
 */

import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface Merge {
  igdbId: number;
  keepId: string;
  keepSlug: string;
  move: string[];
  deleteGames: string[];
  deleteFamilies: string[];
}

async function buildPlan(db: Prisma.TransactionClient): Promise<{ merges: Merge[]; problems: string[] }> {
  const families = await db.gameFamily.findMany({
    where: { igdbId: null, games: { some: { igdbId: { not: null } } } },
    select: {
      id: true,
      slug: true,
      createdAt: true,
      _count: {
        select: { achievementSets: true, dlcs: true, bundles: true, buylistItems: true, baseGameFamilies: true, derivedGameFamilies: true },
      },
      games: {
        select: {
          id: true,
          igdbId: true,
          platformId: true,
          platform: { select: { name: true } },
          _count: { select: { userGames: true, collectionItems: true, trophies: true, playSessions: true, buylistItems: true } },
        },
      },
    },
  });

  // Families whose editions are all one IGDB game, grouped by that game
  const byIgdbId = new Map<number, typeof families>();
  for (const family of families) {
    const ids = new Set(family.games.map((game) => game.igdbId));
    if (ids.size !== 1) continue;
    const [igdbId] = [...ids];
    if (igdbId === null || igdbId === undefined) continue;
    byIgdbId.set(igdbId, [...(byIgdbId.get(igdbId) ?? []), family]);
  }

  const merges: Merge[] = [];
  const problems: string[] = [];
  for (const [igdbId, group] of byIgdbId) {
    if (group.length < 2) continue;
    const owner = await db.gameFamily.findUnique({ where: { igdbId }, select: { slug: true } });
    if (owner) {
      problems.push(`#${igdbId}: ${group.map((family) => family.slug).join(", ")} and ${owner.slug} are the same game; merge by hand`);
      continue;
    }
    const attached = group.filter((family) => Object.values(family._count).some((count) => count > 0));
    if (attached.length > 0) {
      problems.push(`#${igdbId}: ${attached.map((family) => family.slug).join(", ")} has achievement sets, DLC, bundles, buylist entries or links; merge by hand`);
      continue;
    }

    // Families imported in one batch can share a timestamp; the shorter slug is
    // usually the one without an importer's "-1" suffix
    const [keep, ...others] = [...group].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.slug.length - b.slug.length || a.slug.localeCompare(b.slug)
    );
    const platformsKept = new Set(keep!.games.map((game) => game.platformId));
    const merge: Merge = { igdbId, keepId: keep!.id, keepSlug: keep!.slug, move: [], deleteGames: [], deleteFamilies: [] };
    let blocked = false;
    for (const other of others) {
      for (const game of other.games) {
        if (!platformsKept.has(game.platformId)) {
          merge.move.push(game.id);
          platformsKept.add(game.platformId);
          console.log(`  #${igdbId}: move ${other.slug} / ${game.platform?.name} into ${keep!.slug}`);
        } else if (Object.values(game._count).every((count) => count === 0)) {
          merge.deleteGames.push(game.id);
          console.log(`  #${igdbId}: delete duplicate ${other.slug} / ${game.platform?.name} (${keep!.slug} has it)`);
        } else {
          problems.push(`#${igdbId}: ${other.slug} / ${game.platform?.name} duplicates ${keep!.slug} but has user data; merge by hand`);
          blocked = true;
        }
      }
      merge.deleteFamilies.push(other.id);
      console.log(`  #${igdbId}: delete family ${other.slug}; ${keep!.slug} takes the IGDB id`);
    }
    if (!blocked) merges.push(merge);
  }
  return { merges, problems };
}

async function main() {
  const apply = process.argv.slice(2).includes("--apply");

  console.log("=== Fix Duplicate IGDB Families ===\n");
  console.log(`Mode: ${apply ? "apply" : "dry run"}`);
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    console.log(`Database host: ${new URL(databaseUrl).host}`);
  }
  console.log("");

  const run = async (db: Prisma.TransactionClient) => {
    const { merges, problems } = await buildPlan(db);
    console.log(`\nMerges: ${merges.length}`);
    if (problems.length > 0) {
      console.log(`Left alone (${problems.length}):`);
      for (const problem of problems) console.log(`  ${problem}`);
    }
    return merges;
  };

  if (!apply) {
    await run(prisma);
    console.log("\n[DRY RUN] Nothing was merged. Run with --apply to merge.");
    return;
  }

  const merged = await prisma.$transaction(async (tx) => {
    const merges = await run(tx);
    for (const merge of merges) {
      if (merge.move.length > 0) {
        await tx.game.updateMany({ where: { id: { in: merge.move } }, data: { gameFamilyId: merge.keepId } });
      }
      if (merge.deleteGames.length > 0) {
        await tx.game.deleteMany({ where: { id: { in: merge.deleteGames } } });
      }
      const deleted = await tx.gameFamily.deleteMany({ where: { id: { in: merge.deleteFamilies }, games: { none: {} } } });
      if (deleted.count !== merge.deleteFamilies.length) {
        throw new Error(`#${merge.igdbId}: a family still had editions after the merge. Rolled back.`);
      }
      await tx.gameFamily.update({ where: { id: merge.keepId }, data: { igdbId: merge.igdbId } });
    }
    return merges.length;
  });

  console.log(`\nMerged ${merged} groups of duplicate families.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
