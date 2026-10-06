/**
 * Correct release dates to Western releases, for editions and for families.
 *
 * Editions get their earliest Western release on their own platform.
 * import-platform-region.ts used to give every edition the IGDB game's first
 * release on any platform, so re-releases carried the original's date (Golden
 * Sun on Wii U was dated 2001, not 2014). Families get their IGDB game's first
 * Western release on any platform, the date the importer compares when it
 * decides whether to reuse a same-titled family.
 *
 * The corrections come from JSON written by check-family-release-dates.ts:
 * --dates-out entries carry a gameId and platform, --family-dates-out entries a
 * familyId. Each has the date the check saw ("from", null when there was none)
 * and IGDB's Western date ("to"). A file may mix both kinds.
 *
 * Family dates can also come from a review sheet (a .csv like
 * scripts/data/family-dates-review-2026-10-06.csv): only rows marked "change"
 * are applied. Once applied, rows are marked "changed"; the script checks
 * those are really at their new date and stops if one isn't.
 *
 * Everything is checked again inside the update transaction: the script stops
 * if a game or family is gone, no longer matches the family (and platform) the
 * check saw, or its date has changed since the check. Updates run in batches
 * and the transaction rolls back if any batch touches a different number of
 * rows.
 *
 * --min-days <n> skips differences smaller than n days (backfills always
 * apply).
 *
 * Usage (<file> is .json or a .csv review sheet):
 *   npx tsx scripts/fix-release-dates.ts --dates <file>           # dry run, prints the plan
 *   npx tsx scripts/fix-release-dates.ts --dates <file> --apply   # updates, in one transaction
 */

import { readFileSync } from "node:fs";
import { Prisma, PrismaClient } from "@prisma/client";
import { readReviewSheet } from "./lib/review-sheet.js";

const prisma = new PrismaClient();

const BATCH_SIZE = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

interface EditionCorrection {
  gameId: string;
  family: string;
  platform: string;
  from: string | null;
  to: string;
  igdb: string;
}

interface FamilyCorrection {
  familyId: string;
  family: string;
  from: string | null;
  to: string;
  igdb: string;
  // Which IGDB release the old date matched, from the check
  match?: string;
}

type DateCorrection = EditionCorrection | FamilyCorrection;

function isFamilyCorrection(correction: DateCorrection): correction is FamilyCorrection {
  return "familyId" in correction;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface CorrectionList {
  corrections: DateCorrection[];
  // Review sheet rows marked as already applied
  alreadyChanged: FamilyCorrection[];
}

function readCorrections(path: string): CorrectionList {
  return path.endsWith(".csv")
    ? readFamilyReviewSheet(path)
    : { corrections: readCorrectionsJson(path), alreadyChanged: [] };
}

// Rows are marked keep, change, changed (already applied) or left blank
function readFamilyReviewSheet(path: string): CorrectionList {
  const list: CorrectionList = { corrections: [], alreadyChanged: [] };
  const rows = readReviewSheet(
    path,
    ["family_slug", "our_date", "igdb_first_western", "igdb_game", "match", "family_id"],
    ["keep", "change", "changed"]
  );
  for (const { line, decision, values } of rows) {
    if (decision !== "change" && decision !== "changed") continue;
    if (!DATE_PATTERN.test(values.our_date) || !DATE_PATTERN.test(values.igdb_first_western) || !values.family_id) {
      throw new Error(`${path} row ${line}: needs our_date and igdb_first_western as YYYY-MM-DD and a family_id`);
    }
    const correction: FamilyCorrection = {
      familyId: values.family_id,
      family: values.family_slug,
      from: values.our_date,
      to: values.igdb_first_western,
      igdb: values.igdb_game,
      match: values.match,
    };
    (decision === "change" ? list.corrections : list.alreadyChanged).push(correction);
  }
  return list;
}

function readCorrectionsJson(path: string): DateCorrection[] {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  const valid =
    Array.isArray(parsed) &&
    parsed.every((entry) => {
      const dates =
        typeof entry?.family === "string" &&
        (entry?.from === null || (typeof entry?.from === "string" && DATE_PATTERN.test(entry.from))) &&
        typeof entry?.to === "string" &&
        DATE_PATTERN.test(entry.to);
      const edition = typeof entry?.gameId === "string" && typeof entry?.platform === "string" && !("familyId" in entry);
      const family = typeof entry?.familyId === "string" && !("gameId" in entry);
      return dates && (edition || family);
    });
  if (!valid) {
    throw new Error(
      `${path} must be an array of { gameId, platform } or { familyId } entries with family, from: YYYY-MM-DD | null, to: YYYY-MM-DD`
    );
  }
  return parsed as DateCorrection[];
}

function formatDate(date: Date | null): string | null {
  return date ? date.toISOString().split("T")[0]! : null;
}

function daysBetween(from: string, to: string): number {
  return Math.round(Math.abs(new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / DAY_MS);
}

interface Plan {
  editions: EditionCorrection[];
  families: FamilyCorrection[];
  skipped: number;
  problems: string[];
}

async function buildPlan(
  db: Prisma.TransactionClient,
  { corrections, alreadyChanged }: CorrectionList,
  minDays: number
): Promise<Plan> {
  const plan: Plan = { editions: [], families: [], skipped: 0, problems: [] };

  if (alreadyChanged.length > 0) {
    const rows = await db.gameFamily.findMany({
      where: { id: { in: alreadyChanged.map((correction) => correction.familyId) } },
      select: { id: true, releaseDate: true },
    });
    const currentById = new Map(rows.map((family) => [family.id, formatDate(family.releaseDate)]));
    for (const correction of alreadyChanged) {
      const current = currentById.get(correction.familyId);
      if (current !== correction.to) {
        plan.problems.push(
          `${correction.family} (family): marked changed, but its date is ${current ?? "missing"}, not ${correction.to}`
        );
      }
    }
  }
  const tooClose = (correction: DateCorrection) =>
    correction.from !== null && daysBetween(correction.from, correction.to) < minDays;

  const editions = corrections.filter((correction): correction is EditionCorrection => !isFamilyCorrection(correction));
  for (let index = 0; index < editions.length; index += BATCH_SIZE) {
    const chunk = editions.slice(index, index + BATCH_SIZE);
    const games = await db.game.findMany({
      where: { id: { in: chunk.map((correction) => correction.gameId) } },
      select: {
        id: true,
        releaseDate: true,
        gameFamily: { select: { slug: true } },
        platform: { select: { name: true } },
      },
    });
    const gamesById = new Map(games.map((game) => [game.id, game]));

    for (const correction of chunk) {
      const label = `${correction.family} / ${correction.platform}`;
      const game = gamesById.get(correction.gameId);
      if (!game) {
        plan.problems.push(`${label}: game ${correction.gameId} no longer exists`);
        continue;
      }
      if (game.gameFamily?.slug !== correction.family || game.platform?.name !== correction.platform) {
        plan.problems.push(
          `${label}: game ${correction.gameId} is now ${game.gameFamily?.slug ?? "no family"} / ${game.platform?.name ?? "no platform"}`
        );
        continue;
      }
      const current = formatDate(game.releaseDate);
      if (current !== correction.from) {
        plan.problems.push(`${label}: date is ${current ?? "none"} now, the check saw ${correction.from ?? "none"}`);
        continue;
      }
      if (tooClose(correction)) {
        plan.skipped++;
        continue;
      }
      plan.editions.push(correction);
    }
  }

  const families = corrections.filter(isFamilyCorrection);
  for (let index = 0; index < families.length; index += BATCH_SIZE) {
    const chunk = families.slice(index, index + BATCH_SIZE);
    const rows = await db.gameFamily.findMany({
      where: { id: { in: chunk.map((correction) => correction.familyId) } },
      select: { id: true, slug: true, releaseDate: true },
    });
    const familiesById = new Map(rows.map((family) => [family.id, family]));

    for (const correction of chunk) {
      const label = `${correction.family} (family)`;
      const family = familiesById.get(correction.familyId);
      if (!family) {
        plan.problems.push(`${label}: family ${correction.familyId} no longer exists`);
        continue;
      }
      if (family.slug !== correction.family) {
        plan.problems.push(`${label}: family ${correction.familyId} is now ${family.slug}`);
        continue;
      }
      const current = formatDate(family.releaseDate);
      if (current !== correction.from) {
        plan.problems.push(`${label}: date is ${current ?? "none"} now, the check saw ${correction.from ?? "none"}`);
        continue;
      }
      if (tooClose(correction)) {
        plan.skipped++;
        continue;
      }
      plan.families.push(correction);
    }
  }

  return plan;
}

function reportUpdates(title: string, updates: DateCorrection[]) {
  if (updates.length === 0) return;
  const backfills = updates.filter((update) => update.from === null).length;
  const changes = updates.filter((update) => update.from !== null);
  const bucket = (label: string, test: (days: number) => boolean) =>
    console.log(`    ${label.padEnd(22)} ${changes.filter((update) => test(daysBetween(update.from!, update.to))).length}`);

  console.log(`${title}: ${updates.length}`);
  console.log(`  backfills (no date before): ${backfills}`);
  console.log(`  changed dates: ${changes.length}`);
  bucket("1 day", (days) => days <= 1);
  bucket("2 to 31 days", (days) => days > 1 && days <= 31);
  bucket("32 days to 1 year", (days) => days > 31 && days <= 366);
  bucket("more than 1 year", (days) => days > 366);
}

function report(plan: Plan, { corrections, alreadyChanged }: CorrectionList, minDays: number) {
  if (alreadyChanged.length > 0) console.log(`Families marked changed: ${alreadyChanged.length}`);
  console.log(`Corrections listed: ${corrections.length}`);
  reportUpdates("Edition updates planned", plan.editions);
  reportUpdates("Family updates planned", plan.families);
  const matches = new Map<string, number>();
  for (const family of plan.families) {
    if (family.match) matches.set(family.match, (matches.get(family.match) ?? 0) + 1);
  }
  if (matches.size > 0) {
    console.log("  old family date matched:");
    for (const [match, count] of matches) console.log(`    ${match.padEnd(22)} ${count}`);
  }
  if (minDays > 0) console.log(`Skipped, under ${minDays} days apart: ${plan.skipped}`);
  if (plan.problems.length > 0) {
    console.log(`\nProblems (${plan.problems.length}), nothing will be updated until these are resolved:`);
    for (const problem of plan.problems.slice(0, 50)) console.log(`  ${problem}`);
    if (plan.problems.length > 50) console.log(`  ... and ${plan.problems.length - 50} more`);
  }
}

// Prisma keeps timestamps in UTC, whatever the session's time zone
async function updateDates(
  tx: Prisma.TransactionClient,
  table: "Game" | "GameFamily",
  updates: Array<{ id: string; to: string }>
): Promise<number> {
  let count = 0;
  for (let index = 0; index < updates.length; index += BATCH_SIZE) {
    const batch = updates.slice(index, index + BATCH_SIZE);
    const rows = Prisma.join(batch.map((update) => Prisma.sql`(${update.id}, ${update.to}::date)`));
    const result = await tx.$executeRaw`
      UPDATE ${Prisma.raw(`"${table}"`)} AS t
      SET "releaseDate" = v.release_date, "updatedAt" = NOW() AT TIME ZONE 'UTC'
      FROM (VALUES ${rows}) AS v(id, release_date)
      WHERE t.id = v.id
    `;
    if (result !== batch.length) {
      throw new Error(`${table} batch at ${index} updated ${result} rows, expected ${batch.length}. Rolled back.`);
    }
    count += result;
  }
  return count;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const valueOf = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const datesPath = valueOf("--dates");
  const minDays = Number.parseInt(valueOf("--min-days") ?? "0", 10);
  if (!datesPath || !Number.isFinite(minDays) || minDays < 0) {
    console.error("Usage: npx tsx scripts/fix-release-dates.ts --dates <file> [--min-days <n>] [--apply]");
    process.exitCode = 1;
    return;
  }
  const corrections = readCorrections(datesPath);

  console.log("=== Fix Release Dates ===\n");
  console.log(`Mode: ${apply ? "apply" : "dry run"}`);
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    console.log(`Database host: ${new URL(databaseUrl).host}`);
  }
  console.log(`Corrections file: ${datesPath}`);
  console.log("");

  if (!apply) {
    report(await buildPlan(prisma, corrections, minDays), corrections, minDays);
    console.log("\n[DRY RUN] Nothing was updated. Run with --apply to update.");
    return;
  }

  const updated = await prisma.$transaction(
    async (tx) => {
      const plan = await buildPlan(tx, corrections, minDays);
      report(plan, corrections, minDays);
      if (plan.problems.length > 0) {
        throw new Error("Stopped before updating anything. See problems above.");
      }

      const games = await updateDates(
        tx,
        "Game",
        plan.editions.map((update) => ({ id: update.gameId, to: update.to }))
      );
      const families = await updateDates(
        tx,
        "GameFamily",
        plan.families.map((update) => ({ id: update.familyId, to: update.to }))
      );
      return { games, families };
    },
    { timeout: 300_000 }
  );

  console.log(`\nUpdated ${updated.games} games and ${updated.families} families.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
