/**
 * Delete families with no editions and edition labels with no games, when
 * nothing else points at them.
 *
 * Deleting editions (fix-unreleased-editions.ts and earlier cleanups) can
 * leave a family or a GameVersion with nothing in it. A family with no games
 * can't be owned or added to a library, and an unused label only clutters
 * the version pickers.
 *
 * A family is kept if it has achievement sets, DLC, buylist entries or
 * base/derived links, or belongs to a bundle: retro collections are
 * bundle-only on purpose (see import-cowabunga-collection.ts), so their
 * member families have no editions on the collection's platforms. A label is
 * kept if any library entry, collection item, achievement set, DLC, buylist
 * entry or per-edition release date uses it. Everything is checked again
 * inside the delete transaction.
 *
 * Usage:
 *   npx tsx scripts/fix-orphan-rows.ts           # dry run, prints the plan
 *   npx tsx scripts/fix-orphan-rows.ts --apply   # deletes, in one transaction
 */

import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface Plan {
  familyIds: string[];
  versionIds: string[];
}

async function buildPlan(db: Prisma.TransactionClient): Promise<Plan> {
  const families = await db.gameFamily.findMany({
    where: { games: { none: {} } },
    select: {
      id: true,
      slug: true,
      title: true,
      _count: {
        select: {
          achievementSets: true,
          dlcs: true,
          bundles: true,
          buylistItems: true,
          baseGameFamilies: true,
          derivedGameFamilies: true,
        },
      },
    },
    orderBy: { slug: "asc" },
  });
  const familyIds: string[] = [];
  for (const family of families) {
    const attached = Object.entries(family._count).filter(([, count]) => count > 0);
    if (attached.length > 0) {
      console.log(`  keep family    ${family.slug.padEnd(40)} (${attached.map(([name, count]) => `${name} ${count}`).join(", ")})`);
      continue;
    }
    console.log(`  delete family  ${family.slug.padEnd(40)} "${family.title}"`);
    familyIds.push(family.id);
  }

  const versions = await db.gameVersion.findMany({
    where: { games: { none: {} } },
    select: {
      id: true,
      slug: true,
      name: true,
      _count: {
        select: {
          userGames: true,
          collectionItems: true,
          achievementSets: true,
          dlcs: true,
          buylistItems: true,
          versionReleaseDates: true,
        },
      },
    },
    orderBy: { slug: "asc" },
  });
  const versionIds: string[] = [];
  for (const version of versions) {
    const used = Object.entries(version._count).filter(([, count]) => count > 0);
    if (used.length > 0) {
      console.log(`  keep label     ${version.slug.padEnd(40)} (${used.map(([name, count]) => `${name} ${count}`).join(", ")})`);
      continue;
    }
    console.log(`  delete label   ${version.slug.padEnd(40)} "${version.name}"`);
    versionIds.push(version.id);
  }

  console.log("");
  console.log(`Families to delete: ${familyIds.length}`);
  console.log(`Labels to delete: ${versionIds.length}`);
  return { familyIds, versionIds };
}

async function main() {
  const apply = process.argv.slice(2).includes("--apply");

  console.log("=== Fix Orphan Rows ===\n");
  console.log(`Mode: ${apply ? "apply" : "dry run"}`);
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    console.log(`Database host: ${new URL(databaseUrl).host}`);
  }
  console.log("");

  if (!apply) {
    await buildPlan(prisma);
    console.log("\n[DRY RUN] Nothing was deleted. Run with --apply to delete.");
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const plan = await buildPlan(tx);
    const families = await tx.gameFamily.deleteMany({
      where: { id: { in: plan.familyIds }, games: { none: {} } },
    });
    const versions = await tx.gameVersion.deleteMany({
      where: { id: { in: plan.versionIds }, games: { none: {} } },
    });
    if (families.count !== plan.familyIds.length || versions.count !== plan.versionIds.length) {
      throw new Error("Something changed while deleting. Rolled back.");
    }
    return { families: families.count, versions: versions.count };
  });

  console.log(`\nDeleted ${result.families} families and ${result.versions} labels.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
