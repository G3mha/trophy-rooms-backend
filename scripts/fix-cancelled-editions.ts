/**
 * Delete Game rows for platform releases that were cancelled.
 *
 * A Game entry needs a platform release someone can own (see CLAUDE.md,
 * Backward Compatibility). check-family-release-dates.ts found these 29
 * editions marked Cancelled on IGDB on 2026-10-05. Most came in because the
 * importer adds a game to an existing family by title, so a cancelled game
 * landed inside a released one that shares its name (the 2007 Dirty Harry,
 * IGDB #78566, inside the 1990 NES family).
 *
 * Families left with no games are deleted too. Everything is checked again
 * inside the delete transaction: the script stops if any edition doesn't
 * resolve to exactly one Game, if any has user data (library, collection,
 * trophies, play sessions, buylist), or if a family about to be emptied has
 * achievement sets, DLC, buylist entries, bundles or base/derived links.
 *
 * Usage:
 *   npx tsx scripts/fix-cancelled-editions.ts           # dry run, prints the plan
 *   npx tsx scripts/fix-cancelled-editions.ts --apply   # deletes, in one transaction
 */

import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// [family slug, platform name, IGDB game the cancellation is recorded on]
const CANCELLED_EDITIONS: Array<[string, string, string]> = [
  ["100-bullets", "Game Boy Advance", "100-bullets #90935"],
  ["100-bullets", "Nintendo DS", "100-bullets #90935"],
  ["100-bullets", "PlayStation 2", "100-bullets #90935"],
  ["100-bullets", "PlayStation Portable", "100-bullets #90935"],
  ["air-nights", "Dreamcast", "air-nights #145516"],
  ["air-nights", "Sega Saturn", "air-nights #145516"],
  ["dirty-harry-1", "PlayStation 2", "dirty-harry--1 #78566"],
  ["dirty-harry-1", "PlayStation Portable", "dirty-harry--1 #78566"],
  ["dirty-harry-excessive-force", "PlayStation 2", "dirty-harry-excessive-force #291010"],
  ["dirty-harry-excessive-force", "PlayStation Portable", "dirty-harry-excessive-force #291010"],
  ["gauntlet-3", "Nintendo DS", "gauntlet--3 #81204"],
  ["journey-to-the-center-of-the-earth-4", "Game Boy", "journey-to-the-center-of-the-earth--7 #350128"],
  ["kameo-elements-of-power", "Nintendo 64", "kameo-elements-of-power--1 #279354"],
  ["omikron-2-nomad-soul-exodus", "Dreamcast", "omikron-2-nomad-soul-exodus #67717"],
  ["omikron-2-nomad-soul-exodus", "PlayStation 2", "omikron-2-nomad-soul-exodus #67717"],
  ["rayman-2", "PlayStation", "rayman-2 #193310"],
  ["rayman-2", "Sega Saturn", "rayman-2 #193310"],
  ["the-incredible-shrinking-character", "PlayStation", "the-incredible-shrinking-character #287836"],
  ["the-incredible-shrinking-character", "Sega Saturn", "the-incredible-shrinking-character #287836"],
  ["the-sacred-pools", "PlayStation", "the-sacred-pools #223823"],
  ["the-sacred-pools", "Sega Saturn", "the-sacred-pools #223823"],
  ["too-human-1", "GameCube", "too-human--1 #292152"],
  ["too-human-1", "PlayStation", "too-human--1 #292152"],
  ["wacky-races-3", "Sega Genesis", "wacky-races--4 #214981"],
  ["x", "Super Nintendo", "x--1 #172448"],
  ["x10", "GameCube", "x10 #307828"],
  ["x10", "PlayStation 2", "x10 #307828"],
  ["x10", "Xbox", "x10 #307828"],
  ["yoshi-touch-and-go", "GameCube", "yoshi-touch-and-go--1 #231475"],
];

interface Plan {
  gameIds: string[];
  familyIds: string[];
  problems: string[];
}

async function buildPlan(db: Prisma.TransactionClient): Promise<Plan> {
  const problems: string[] = [];
  const gameIds: string[] = [];
  const familyIdsTouched = new Set<string>();

  for (const [familySlug, platformName, igdbSource] of CANCELLED_EDITIONS) {
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

function report(plan: Plan) {
  console.log("");
  console.log(`Editions listed: ${CANCELLED_EDITIONS.length}`);
  console.log(`Games to delete: ${plan.gameIds.length}`);
  console.log(`Families to delete: ${plan.familyIds.length}`);
  if (plan.problems.length > 0) {
    console.log(`\nProblems (${plan.problems.length}), nothing will be deleted until these are resolved:`);
    for (const problem of plan.problems) console.log(`  ${problem}`);
  }
}

async function main() {
  const apply = process.argv.slice(2).includes("--apply");

  console.log("=== Fix Cancelled Editions ===\n");
  console.log(`Mode: ${apply ? "apply" : "dry run"}`);
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    console.log(`Database host: ${new URL(databaseUrl).host}`);
  }
  console.log("");

  if (!apply) {
    report(await buildPlan(prisma));
    console.log("\n[DRY RUN] Nothing was deleted. Run with --apply to delete.");
    return;
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const plan = await buildPlan(tx);
      report(plan);
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
