/**
 * Delete Game rows for platform releases that were cancelled.
 *
 * A Game entry needs a platform release someone can own (see CLAUDE.md,
 * Backward Compatibility). The editions come from a JSON file written by
 * check-family-release-dates.ts --cancelled-out, which marks an edition
 * cancelled when IGDB has no shipped release for it on that platform and
 * records the release, or the whole game, as Cancelled. Most of these came in
 * because the importer counted cancelled releases as releases, and because it
 * adds a game to an existing family by title, so a cancelled game could land
 * inside a released one that shares its name (the 2007 Dirty Harry, IGDB
 * #78566, inside the 1990 NES family). Lists that have been applied are kept
 * in scripts/data/; the first batch of 29 is in this file's history at
 * ac34ff8.
 *
 * Families left with no games are deleted too. Everything is checked again
 * inside the delete transaction: the script stops if any edition doesn't
 * resolve to exactly one Game, if any has user data (library, collection,
 * trophies, play sessions, buylist), or if a family about to be emptied has
 * achievement sets, DLC, buylist entries, bundles or base/derived links.
 *
 * Usage:
 *   npx tsx scripts/fix-unreleased-editions.ts --editions <file>           # dry run, prints the plan
 *   npx tsx scripts/fix-unreleased-editions.ts --editions <file> --apply   # deletes, in one transaction
 */

import { readFileSync } from "node:fs";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface CancelledEdition {
  family: string;
  platform: string;
  // IGDB game(s) the cancellation is recorded on, for the log
  igdb: string;
}

function readEditions(path: string): CancelledEdition[] {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      (entry) =>
        typeof entry?.family === "string" &&
        typeof entry?.platform === "string" &&
        typeof entry?.igdb === "string"
    )
  ) {
    throw new Error(`${path} must be an array of { family, platform, igdb } strings`);
  }
  return parsed as CancelledEdition[];
}

interface Plan {
  gameIds: string[];
  familyIds: string[];
  problems: string[];
}

async function buildPlan(db: Prisma.TransactionClient, editions: CancelledEdition[]): Promise<Plan> {
  const problems: string[] = [];
  const gameIds: string[] = [];
  const familyIdsTouched = new Set<string>();

  for (const { family: familySlug, platform: platformName, igdb: igdbSource } of editions) {
    const games = await db.game.findMany({
      where: { gameFamily: { slug: familySlug }, platform: { name: platformName } },
      select: {
        id: true,
        gameFamilyId: true,
        _count: {
          select: {
            userGames: true,
            collectionItems: true,
            trophies: true,
            playSessions: true,
            buylistItems: true,
          },
        },
      },
    });

    const label = `${familySlug} / ${platformName}`;
    if (games.length !== 1) {
      problems.push(`${label}: expected 1 game, found ${games.length}`);
      continue;
    }

    const game = games[0]!;
    const attached = Object.entries(game._count).filter(([, count]) => count > 0);
    if (attached.length > 0) {
      problems.push(`${label}: has user data (${attached.map(([name, count]) => `${name} ${count}`).join(", ")})`);
      continue;
    }

    console.log(`  delete game   ${label.padEnd(56)} [IGDB ${igdbSource}]`);
    gameIds.push(game.id);
    if (game.gameFamilyId) familyIdsTouched.add(game.gameFamilyId);
  }

  const familyIds: string[] = [];
  const families = await db.gameFamily.findMany({
    where: { id: { in: Array.from(familyIdsTouched) } },
    select: {
      id: true,
      slug: true,
      games: { select: { id: true } },
      _count: {
        select: {
          achievementSets: true,
          dlcs: true,
          buylistItems: true,
          bundles: true,
          baseGameFamilies: true,
          derivedGameFamilies: true,
        },
      },
    },
    orderBy: { slug: "asc" },
  });

  const deleting = new Set(gameIds);
  for (const family of families) {
    const remaining = family.games.filter((game) => !deleting.has(game.id)).length;
    if (remaining > 0) {
      console.log(`  keep family   ${family.slug.padEnd(56)} (${remaining} released edition${remaining === 1 ? "" : "s"} left)`);
      continue;
    }

    const attached = Object.entries(family._count).filter(([, count]) => count > 0);
    if (attached.length > 0) {
      problems.push(`${family.slug}: would be left empty but has ${attached.map(([name, count]) => `${name} ${count}`).join(", ")}`);
      continue;
    }

    console.log(`  delete family ${family.slug.padEnd(56)} (no editions left)`);
    familyIds.push(family.id);
  }

  return { gameIds, familyIds, problems };
}

function report(plan: Plan, editions: CancelledEdition[]) {
  console.log("");
  console.log(`Editions listed: ${editions.length}`);
  console.log(`Games to delete: ${plan.gameIds.length}`);
  console.log(`Families to delete: ${plan.familyIds.length}`);
  if (plan.problems.length > 0) {
    console.log(`\nProblems (${plan.problems.length}), nothing will be deleted until these are resolved:`);
    for (const problem of plan.problems) console.log(`  ${problem}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const editionsIndex = args.indexOf("--editions");
  const editionsPath = editionsIndex >= 0 ? args[editionsIndex + 1] : undefined;
  if (!editionsPath) {
    console.error("Usage: npx tsx scripts/fix-unreleased-editions.ts --editions <file> [--apply]");
    process.exitCode = 1;
    return;
  }
  const editions = readEditions(editionsPath);

  console.log("=== Fix Unreleased Editions ===\n");
  console.log(`Mode: ${apply ? "apply" : "dry run"}`);
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    console.log(`Database host: ${new URL(databaseUrl).host}`);
  }
  console.log(`Editions file: ${editionsPath}`);
  console.log("");

  if (!apply) {
    report(await buildPlan(prisma, editions), editions);
    console.log("\n[DRY RUN] Nothing was deleted. Run with --apply to delete.");
    return;
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const plan = await buildPlan(tx, editions);
      report(plan, editions);
      if (plan.problems.length > 0) {
        throw new Error("Stopped before deleting anything. See problems above.");
      }

      const games = await tx.game.deleteMany({ where: { id: { in: plan.gameIds } } });
      const families = await tx.gameFamily.deleteMany({ where: { id: { in: plan.familyIds } } });
      return { games: games.count, families: families.count };
    },
    { timeout: 60_000 }
  );

  console.log(`\nDeleted ${result.games} games and ${result.families} families.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
