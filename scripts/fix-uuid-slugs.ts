/**
 * Give families a readable slug in place of one ending in IGDB's UUID.
 *
 * IGDB tells same-named games apart with a UUID suffix
 * ("twisted-metal-3bd4555a-3fd8-41bd-a0d7-d47d8c707651"), and importers used
 * to copy it into the family slug. The suffix is dropped and, when the plain
 * slug is taken, a counter is added the way import-platform-region.ts does
 * ("twisted-metal-1"). A slug is part of the family's URL, so --since limits
 * the change to families created after a time, such as one import's.
 *
 * Usage:
 *   npx tsx scripts/fix-uuid-slugs.ts [--since <ISO time>]           # dry run, prints the plan
 *   npx tsx scripts/fix-uuid-slugs.ts [--since <ISO time>] --apply   # renames, in one transaction
 */

import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const UUID_SUFFIX = /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function buildPlan(db: Prisma.TransactionClient, since?: Date) {
  const families = await db.gameFamily.findMany({
    where: since ? { createdAt: { gte: since } } : {},
    select: { id: true, slug: true },
  });
  const taken = new Set((await db.gameFamily.findMany({ select: { slug: true } })).map((family) => family.slug));
  const renames: Array<{ id: string; from: string; to: string }> = [];
  for (const family of families.filter((family) => UUID_SUFFIX.test(family.slug))) {
    const base = family.slug.replace(UUID_SUFFIX, "");
    let slug = base;
    for (let counter = 1; taken.has(slug); counter++) slug = `${base}-${counter}`;
    taken.add(slug);
    renames.push({ id: family.id, from: family.slug, to: slug });
    console.log(`  ${family.slug} -> ${slug}`);
  }
  console.log(`\nSlugs to rename: ${renames.length}`);
  return renames;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const sinceIndex = args.indexOf("--since");
  const since = sinceIndex >= 0 && args[sinceIndex + 1] ? new Date(args[sinceIndex + 1]!) : undefined;
  if (since && Number.isNaN(since.getTime())) {
    console.error("Usage: npx tsx scripts/fix-uuid-slugs.ts [--since <ISO time>] [--apply]");
    process.exitCode = 1;
    return;
  }

  console.log("=== Fix UUID Slugs ===\n");
  console.log(`Mode: ${apply ? "apply" : "dry run"}`);
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    console.log(`Database host: ${new URL(databaseUrl).host}`);
  }
  console.log(`Families: ${since ? `created since ${since.toISOString()}` : "all"}`);
  console.log("");

  if (!apply) {
    await buildPlan(prisma, since);
    console.log("\n[DRY RUN] Nothing was renamed. Run with --apply to rename.");
    return;
  }

  const renamed = await prisma.$transaction(async (tx) => {
    const renames = await buildPlan(tx, since);
    for (const rename of renames) {
      const result = await tx.gameFamily.updateMany({ where: { id: rename.id, slug: rename.from }, data: { slug: rename.to } });
      if (result.count !== 1) throw new Error(`${rename.from} changed while renaming. Rolled back.`);
    }
    return renames.length;
  });

  console.log(`\nRenamed ${renamed} slugs.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
