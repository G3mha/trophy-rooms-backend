/**
 * Split families that hold different games under one title.
 *
 * Importers add a game to an existing family by title, so one family can hold
 * editions of different IGDB games that share a name (the 1993 Genesis X-Men
 * and the 1992 arcade X-Men). The input is a review sheet written from
 * check-family-release-dates.ts (scripts/data/ambiguous-families-*.csv): its
 * editions_by_igdb_game column groups the family's editions by the IGDB game
 * they matched, and only rows marked "split" are acted on. Remakes and ports
 * of one game stay together (CLAUDE.md: Link's Awakening on Switch), so those
 * rows are marked "keep".
 *
 * One group stays in the family: the one whose IGDB game's first Western
 * release is the family's date, else the one whose slug matches the family's,
 * else the earliest. Editions the sheet couldn't tie to one IGDB game stay
 * too. Each other group gets a new family built from IGDB
 * (title, description, cover, first Western release, searchTitle) and its
 * editions move there. Editions keep their own dates, labels and user data.
 *
 * Everything is checked again inside the transaction. The script stops if a
 * family or edition changed since the sheet was written, if the family has
 * achievement sets, DLC, bundles, buylist entries or base/derived links
 * (which would need a person to decide where they go), if a moved edition has
 * trophies, if an edition label with a cover would end up shared across
 * families, or if a new family's slug is taken by another family.
 *
 * Once applied, rows are marked "done"; the script checks those families now
 * hold a single group.
 *
 * Usage:
 *   npx tsx scripts/fix-split-families.ts --sheet <file>           # dry run, prints the plan
 *   npx tsx scripts/fix-split-families.ts --sheet <file> --apply   # splits, in one transaction
 */

import { Prisma, PrismaClient, type GameType } from "@prisma/client";
import {
  getCoverUrl,
  igdbRequest,
  isShippedRelease,
  isWesternRelease,
  type IGDBReleaseDate,
} from "../src/lib/igdb.js";
import { normalizeForSearch } from "../src/lib/normalize-search.js";
import { readReviewSheet } from "./lib/review-sheet.js";

const prisma = new PrismaClient();

interface Group {
  igdbId: number;
  igdbSlug: string;
  platforms: string[];
}

interface SheetFamily {
  line: number;
  decision: string;
  title: string;
  familySlug: string;
  familyId: string;
  groups: Group[];
}

interface IGDBGameDetails {
  id: number;
  name: string;
  slug: string;
  summary?: string;
  cover?: { image_id: string };
  release_dates?: IGDBReleaseDate[];
}

interface NewFamily {
  igdb: IGDBGameDetails;
  slug: string;
  releaseDate: Date | null;
  gameIds: string[];
  platforms: string[];
  userDataRows: number;
}

interface FamilyPlan {
  sheet: SheetFamily;
  sourceId: string;
  sourceType: GameType;
  staying: Group;
  reason: string;
  // Editions the sheet couldn't tie to one IGDB game; they stay in the family
  unassigned: string[];
  moves: NewFamily[];
}

interface Plan {
  families: FamilyPlan[];
  problems: string[];
}

// "slug #id: Platform 2001-01-01, Platform none | slug2 #id2: ..."
function parseGroups(text: string, where: string): Group[] {
  return text.split(" | ").map((groupText) => {
    const group = groupText.match(/^(\S+) #(\d+): (.+)$/);
    if (!group) throw new Error(`${where}: can't read IGDB group "${groupText}"`);
    const platforms = group[3]!.split(", ").map((edition) => {
      const match = edition.match(/^(.+) (\d{4}-\d{2}-\d{2}|none)$/);
      if (!match) throw new Error(`${where}: can't read edition "${edition}"`);
      return match[1]!;
    });
    return { igdbSlug: group[1]!, igdbId: Number(group[2]), platforms };
  });
}

function readSheet(path: string): SheetFamily[] {
  return readReviewSheet(
    path,
    ["game", "family_slug", "family_id", "editions_by_igdb_game"],
    ["keep", "split", "done"]
  )
    .filter((row) => row.decision === "split" || row.decision === "done")
    .map(({ line, decision, values }) => ({
      line,
      decision,
      title: values.game,
      familySlug: values.family_slug,
      familyId: values.family_id,
      groups: parseGroups(values.editions_by_igdb_game, `${path} row ${line}`),
    }));
}

// Same rule as the importers: runs of non-alphanumerics collapse, so IGDB's
// "x-men--1" is "x-men-1"
function normalizeSlug(slug: string): string {
  return slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function formatDate(date: Date | null): string {
  return date ? date.toISOString().split("T")[0]! : "none";
}

function firstWesternRelease(game: IGDBGameDetails): Date | null {
  const dates = (game.release_dates ?? [])
    .filter(isShippedRelease)
    .filter(isWesternRelease)
    .map((release) => release.date * 1000);
  return dates.length > 0 ? new Date(Math.min(...dates)) : null;
}

async function fetchIgdbGames(ids: number[]): Promise<Map<number, IGDBGameDetails>> {
  const games = await igdbRequest<IGDBGameDetails[]>(
    "games",
    `fields id, name, slug, summary, cover.image_id, release_dates.platform, release_dates.date, release_dates.release_region, release_dates.status.name; where id = (${ids.join(", ")}); limit ${ids.length};`
  );
  return new Map(games.map((game) => [game.id, game]));
}

async function buildPlan(
  db: Prisma.TransactionClient,
  sheet: SheetFamily[],
  igdbGames: Map<number, IGDBGameDetails>
): Promise<Plan> {
  const plan: Plan = { families: [], problems: [] };
  const plannedSlugs = new Set<string>();

  for (const row of sheet) {
    const label = `${row.familySlug} (row ${row.line})`;
    const family = await db.gameFamily.findUnique({
      where: { id: row.familyId },
      select: {
        id: true,
        slug: true,
        type: true,
        releaseDate: true,
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
        games: {
          select: {
            id: true,
            platform: { select: { name: true } },
            versions: { select: { slug: true, coverUrl: true, games: { select: { id: true } } } },
            _count: { select: { trophies: true, userGames: true, collectionItems: true, playSessions: true, buylistItems: true } },
          },
        },
      },
    });
    if (!family || family.slug !== row.familySlug) {
      plan.problems.push(`${label}: family ${row.familyId} is ${family ? `now ${family.slug}` : "gone"}`);
      continue;
    }
    const platformsInFamily = new Set(family.games.map((game) => game.platform?.name ?? ""));

    if (row.decision === "done") {
      const groupsPresent = row.groups.filter((group) => group.platforms.some((platform) => platformsInFamily.has(platform)));
      if (groupsPresent.length > 1) {
        plan.problems.push(`${label}: marked done, but still holds editions of ${groupsPresent.map((group) => group.igdbSlug).join(", ")}`);
      } else {
        console.log(`  already split  ${row.familySlug}`);
      }
      continue;
    }

    const attached = Object.entries(family._count).filter(([, count]) => count > 0);
    if (attached.length > 0) {
      plan.problems.push(`${label}: has ${attached.map(([name, count]) => `${name} ${count}`).join(", ")}; split it by hand`);
      continue;
    }
    const missing = row.groups.flatMap((group) => group.platforms).filter((platform) => !platformsInFamily.has(platform));
    if (missing.length > 0) {
      plan.problems.push(`${label}: no longer has editions on ${missing.join(", ")}`);
      continue;
    }
    const unknown = row.groups.filter((group) => !igdbGames.has(group.igdbId));
    if (unknown.length > 0) {
      plan.problems.push(`${label}: IGDB returned nothing for ${unknown.map((group) => `#${group.igdbId}`).join(", ")}`);
      continue;
    }

    // Which group stays: the family's own date, then its slug, then the earliest release
    const firstDates = new Map(row.groups.map((group) => [group, firstWesternRelease(igdbGames.get(group.igdbId)!)]));
    const byDate = row.groups.filter((group) => formatDate(firstDates.get(group)!) === formatDate(family.releaseDate));
    const bySlug = row.groups.filter((group) => normalizeSlug(group.igdbSlug) === family.slug);
    const dated = row.groups.filter((group) => firstDates.get(group));
    const earliest = [...dated].sort((a, b) => firstDates.get(a)!.getTime() - firstDates.get(b)!.getTime());
    let staying: Group | undefined;
    let reason = "";
    if (family.releaseDate && byDate.length === 1) {
      staying = byDate[0];
      reason = `its first Western release is the family date ${formatDate(family.releaseDate)}`;
    } else if (bySlug.length === 1) {
      staying = bySlug[0];
      reason = `its IGDB slug matches the family slug`;
    } else if (earliest.length > 0 && (earliest.length === 1 || firstDates.get(earliest[0]!)!.getTime() < firstDates.get(earliest[1]!)!.getTime())) {
      staying = earliest[0];
      reason = `it was released first`;
    }
    if (!staying) {
      plan.problems.push(`${label}: can't tell which game the family is`);
      continue;
    }

    const moves: NewFamily[] = [];
    let rowProblem = false;
    for (const group of row.groups.filter((candidate) => candidate !== staying)) {
      const igdb = igdbGames.get(group.igdbId)!;
      const games = family.games.filter((game) => group.platforms.includes(game.platform?.name ?? ""));
      const movingIds = new Set(games.map((game) => game.id));

      const withTrophies = games.filter((game) => game._count.trophies > 0);
      if (withTrophies.length > 0) {
        plan.problems.push(`${label}: ${withTrophies.map((game) => game.platform?.name).join(", ")} has trophies`);
        rowProblem = true;
      }
      const sharedCovers = games
        .flatMap((game) => game.versions)
        .filter((version) => version.coverUrl && version.games.some((linked) => !movingIds.has(linked.id)));
      if (sharedCovers.length > 0) {
        plan.problems.push(`${label}: edition label ${sharedCovers.map((version) => version.slug).join(", ")} has a cover and would span families`);
        rowProblem = true;
      }

      // A clash with the family being split gets a suffix, like the importer does;
      // a clash with any other family might be the same game, so a person decides
      let slug = normalizeSlug(igdb.slug);
      const taken = await db.gameFamily.findUnique({ where: { slug }, select: { id: true } });
      if (taken && taken.id !== family.id) {
        plan.problems.push(`${label}: slug ${slug} for ${igdb.slug} #${igdb.id} belongs to another family; merge or rename by hand`);
        rowProblem = true;
      }
      for (let counter = 1; slug === family.slug || plannedSlugs.has(slug); counter++) {
        slug = `${normalizeSlug(igdb.slug)}-${counter}`;
      }
      if (await db.gameFamily.findUnique({ where: { slug }, select: { id: true } }).then((found) => found && found.id !== family.id)) {
        plan.problems.push(`${label}: slug ${slug} is taken`);
        rowProblem = true;
      }
      plannedSlugs.add(slug);

      moves.push({
        igdb,
        slug,
        releaseDate: firstDates.get(group)!,
        gameIds: games.map((game) => game.id),
        platforms: group.platforms,
        userDataRows: games.reduce(
          (sum, game) => sum + game._count.userGames + game._count.collectionItems + game._count.playSessions + game._count.buylistItems,
          0
        ),
      });
    }
    if (rowProblem) continue;

    const grouped = new Set(row.groups.flatMap((group) => group.platforms));
    const unassigned = [...platformsInFamily].filter((platform) => !grouped.has(platform)).sort();
    plan.families.push({ sheet: row, sourceId: family.id, sourceType: family.type, staying, reason, unassigned, moves });
  }

  return plan;
}

async function report(plan: Plan, sheet: SheetFamily[]) {
  const descriptions = new Map(
    (
      await prisma.gameFamily.findMany({
        where: { id: { in: plan.families.map((family) => family.sourceId) } },
        select: { id: true, description: true },
      })
    ).map((family) => [family.id, family.description])
  );
  for (const family of plan.families) {
    const description = descriptions.get(family.sourceId)?.replace(/\s+/g, " ").slice(0, 110) ?? "(no description)";
    console.log(`${family.sheet.title} (${family.sheet.familySlug})`);
    console.log(`  family description: ${description}${description.length === 110 ? "..." : ""}`);
    console.log(`  stays    ${family.staying.igdbSlug} #${family.staying.igdbId}: ${family.staying.platforms.join(", ")}  (${family.reason})`);
    if (family.unassigned.length > 0) {
      console.log(`  also stays (not tied to one IGDB game): ${family.unassigned.join(", ")}`);
    }
    for (const move of family.moves) {
      console.log(
        `  new      ${move.slug} "${move.igdb.name}", first Western release ${formatDate(move.releaseDate)}, ` +
          `${move.igdb.cover ? "cover" : "no cover"}, ${move.igdb.summary ? "description" : "no description"}: ` +
          `moves ${move.platforms.join(", ")}${move.userDataRows > 0 ? ` (${move.userDataRows} user data rows move with them)` : ""}`
      );
    }
    console.log("");
  }

  const moves = plan.families.flatMap((family) => family.moves);
  console.log(`Rows marked split or done: ${sheet.length}`);
  console.log(`Families to split: ${plan.families.length}`);
  console.log(`New families: ${moves.length}`);
  console.log(`Editions to move: ${moves.reduce((sum, move) => sum + move.gameIds.length, 0)}`);
  if (plan.problems.length > 0) {
    console.log(`\nProblems (${plan.problems.length}), nothing will be split until these are resolved:`);
    for (const problem of plan.problems) console.log(`  ${problem}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const sheetIndex = args.indexOf("--sheet");
  const sheetPath = sheetIndex >= 0 ? args[sheetIndex + 1] : undefined;
  if (!sheetPath) {
    console.error("Usage: npx tsx scripts/fix-split-families.ts --sheet <file> [--apply]");
    process.exitCode = 1;
    return;
  }
  const sheet = readSheet(sheetPath);

  console.log("=== Fix Split Families ===\n");
  console.log(`Mode: ${apply ? "apply" : "dry run"}`);
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    console.log(`Database host: ${new URL(databaseUrl).host}`);
  }
  console.log(`Sheet: ${sheetPath}`);
  console.log("");

  const igdbIds = Array.from(new Set(sheet.filter((row) => row.decision === "split").flatMap((row) => row.groups.map((group) => group.igdbId))));
  const igdbGames = igdbIds.length > 0 ? await fetchIgdbGames(igdbIds) : new Map<number, IGDBGameDetails>();

  if (!apply) {
    const plan = await buildPlan(prisma, sheet, igdbGames);
    await report(plan, sheet);
    console.log("\n[DRY RUN] Nothing was changed. Run with --apply to split.");
    return;
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const plan = await buildPlan(tx, sheet, igdbGames);
      if (plan.problems.length > 0) {
        await report(plan, sheet);
        throw new Error("Stopped before splitting anything. See problems above.");
      }

      let families = 0;
      let editions = 0;
      for (const family of plan.families) {
        for (const move of family.moves) {
          const created = await tx.gameFamily.create({
            data: {
              title: move.igdb.name.trim(),
              slug: move.slug,
              searchTitle: normalizeForSearch(move.igdb.name.trim()),
              description: move.igdb.summary?.trim() || null,
              coverUrl: move.igdb.cover?.image_id ? getCoverUrl(move.igdb.cover.image_id, "cover_big") : null,
              releaseDate: move.releaseDate,
              type: family.sourceType,
              screenshots: [],
            },
            select: { id: true },
          });
          const moved = await tx.game.updateMany({
            where: { id: { in: move.gameIds }, gameFamilyId: family.sourceId },
            data: { gameFamilyId: created.id },
          });
          if (moved.count !== move.gameIds.length) {
            throw new Error(`${family.sheet.familySlug}: moved ${moved.count} editions to ${move.slug}, expected ${move.gameIds.length}. Rolled back.`);
          }
          families++;
          editions += moved.count;
        }
      }
      return { plan, families, editions };
    },
    { timeout: 120_000 }
  );

  await report(result.plan, sheet);
  console.log(`\nCreated ${result.families} families and moved ${result.editions} editions.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
