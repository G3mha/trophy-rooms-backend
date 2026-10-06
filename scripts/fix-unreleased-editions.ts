/**
 * Delete Game rows for editions that were never released on their platform.
 *
 * A Game entry needs a platform release someone can own (see CLAUDE.md,
 * Backward Compatibility). Two kinds of edition fail that:
 *
 * - Cancelled ports. check-family-release-dates.ts --cancelled-out writes them
 *   as JSON: editions with no shipped IGDB release on the platform whose
 *   release, or whole game, IGDB records as Cancelled. Most came in because
 *   the importer counted cancelled releases as releases, and because it adds
 *   a game to an existing family by title, so a cancelled game could land
 *   inside a released one that shares its name (the 2007 Dirty Harry, IGDB
 *   #78566, inside the 1990 NES family).
 * - Next-gen editions that IGDB only records as a patch to the last-gen game
 *   (a free Switch 2 update, say). These need a person to decide, so they go
 *   through a review sheet: a CSV with decision, family_slug, platform and
 *   igdb_game columns, where only rows marked "delete" are acted on. Once
 *   applied, rows are marked "deleted" so the sheet keeps the record; the
 *   script checks those are really gone and stops if one is still there.
 *
 * Lists that have been applied are kept in scripts/data/. The first batch of
 * 29 is in this file's history, at ac34ff8 under fix-cancelled-editions.ts.
 *
 * Families left with no games are deleted too. Everything is checked again
 * inside the delete transaction: the script stops if any edition doesn't
 * resolve to exactly one Game, if any has user data (library, collection,
 * trophies, play sessions, buylist), or if a family about to be emptied has
 * achievement sets, DLC, buylist entries, bundles or base/derived links.
 *
 * Usage (<file> is .json or .csv):
 *   npx tsx scripts/fix-unreleased-editions.ts --editions <file>           # dry run, prints the plan
 *   npx tsx scripts/fix-unreleased-editions.ts --editions <file> --apply   # deletes, in one transaction
 */

import { readFileSync } from "node:fs";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface UnreleasedEdition {
  family: string;
  platform: string;
  // IGDB game(s) the evidence is recorded on, for the log
  igdb: string;
}

interface EditionList {
  toDelete: UnreleasedEdition[];
  // Rows a review sheet marks as already deleted
  alreadyDeleted: UnreleasedEdition[];
}

function readEditions(path: string): EditionList {
  return path.endsWith(".csv")
    ? readReviewSheet(path)
    : { toDelete: readEditionsJson(path), alreadyDeleted: [] };
}

function readEditionsJson(path: string): UnreleasedEdition[] {
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
  return parsed as UnreleasedEdition[];
}

// Rows are marked keep, delete, deleted (already applied) or left blank;
// anything else in the decision column stops the run
function readReviewSheet(path: string): EditionList {
  const [header, ...rows] = parseCsv(readFileSync(path, "utf8"));
  if (!header) throw new Error(`${path} is empty`);
  const column = (name: string) => {
    const index = header.indexOf(name);
    if (index < 0) throw new Error(`${path} has no "${name}" column`);
    return index;
  };
  const decision = column("decision");
  const family = column("family_slug");
  const platform = column("platform");
  const igdb = column("igdb_game");

  const list: EditionList = { toDelete: [], alreadyDeleted: [] };
  rows.forEach((row, index) => {
    const value = (row[decision] ?? "").trim().toLowerCase();
    if (value !== "" && value !== "keep" && value !== "delete" && value !== "deleted") {
      throw new Error(
        `${path} row ${index + 2}: decision must be keep, delete, deleted or blank, got "${row[decision]}"`
      );
    }
    const edition = { family: row[family] ?? "", platform: row[platform] ?? "", igdb: row[igdb] ?? "" };
    if (value === "delete") list.toDelete.push(edition);
    if (value === "deleted") list.alreadyDeleted.push(edition);
  });
  return list;
}

// RFC 4180: quoted fields may hold commas, newlines and doubled quotes
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    if (quoted) {
      if (char === '"' && text.charAt(i + 1) === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text.charAt(i + 1) === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell !== ""));
}

interface Plan {
  gameIds: string[];
  familyIds: string[];
  problems: string[];
}

async function buildPlan(db: Prisma.TransactionClient, editions: EditionList): Promise<Plan> {
  const problems: string[] = [];
  const gameIds: string[] = [];
  const familyIdsTouched = new Set<string>();

  for (const { family: familySlug, platform: platformName } of editions.alreadyDeleted) {
    const label = `${familySlug} / ${platformName}`;
    const remaining = await db.game.count({
      where: { gameFamily: { slug: familySlug }, platform: { name: platformName } },
    });
    if (remaining > 0) {
      problems.push(`${label}: marked deleted, but ${remaining} game${remaining === 1 ? " is" : "s are"} still in the database`);
      continue;
    }
    console.log(`  already gone  ${label}`);
  }

  for (const { family: familySlug, platform: platformName, igdb: igdbSource } of editions.toDelete) {
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

function report(plan: Plan, editions: EditionList) {
  console.log("");
  if (editions.alreadyDeleted.length > 0) {
    console.log(`Editions marked deleted: ${editions.alreadyDeleted.length}`);
  }
  console.log(`Editions listed: ${editions.toDelete.length}`);
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
