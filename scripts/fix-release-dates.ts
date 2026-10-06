/**
 * Correct Game release dates to each edition's earliest Western release on
 * its own platform.
 *
 * import-platform-region.ts used to give every edition the IGDB game's first
 * release on any platform, so re-releases carried the original's date (Golden
 * Sun on Wii U was dated 2001, not 2014). The corrections come from a JSON
 * file written by check-family-release-dates.ts --dates-out: one entry per
 * edition with its game id, the date the check saw ("from", null when there
 * was none) and IGDB's Western date ("to").
 *
 * Everything is checked again inside the update transaction: the script stops
 * if a game is gone, no longer belongs to the family and platform the check
 * saw, or its date has changed since the check. Updates run in batches and the
 * transaction rolls back if any batch touches a different number of rows.
 *
 * --min-days <n> skips differences smaller than n days (backfills always
 * apply).
 *
 * Usage:
 *   npx tsx scripts/fix-release-dates.ts --dates <file>           # dry run, prints the plan
 *   npx tsx scripts/fix-release-dates.ts --dates <file> --apply   # updates, in one transaction
 */

import { readFileSync } from "node:fs";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BATCH_SIZE = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

interface DateCorrection {
  gameId: string;
  family: string;
  platform: string;
  from: string | null;
  to: string;
  igdb: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function readCorrections(path: string): DateCorrection[] {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      (entry) =>
        typeof entry?.gameId === "string" &&
        typeof entry?.family === "string" &&
        typeof entry?.platform === "string" &&
        (entry?.from === null || (typeof entry?.from === "string" && DATE_PATTERN.test(entry.from))) &&
        typeof entry?.to === "string" &&
        DATE_PATTERN.test(entry.to)
    )
  ) {
    throw new Error(`${path} must be an array of { gameId, family, platform, from: YYYY-MM-DD | null, to: YYYY-MM-DD }`);
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
  updates: DateCorrection[];
  skipped: number;
  problems: string[];
}

async function buildPlan(
  db: Prisma.TransactionClient,
  corrections: DateCorrection[],
  minDays: number
): Promise<Plan> {
  const problems: string[] = [];
  const updates: DateCorrection[] = [];
  let skipped = 0;

  for (let index = 0; index < corrections.length; index += BATCH_SIZE) {
    const chunk = corrections.slice(index, index + BATCH_SIZE);
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
        problems.push(`${label}: game ${correction.gameId} no longer exists`);
        continue;
      }
      if (game.gameFamily?.slug !== correction.family || game.platform?.name !== correction.platform) {
        problems.push(
          `${label}: game ${correction.gameId} is now ${game.gameFamily?.slug ?? "no family"} / ${game.platform?.name ?? "no platform"}`
        );
        continue;
      }
      const current = formatDate(game.releaseDate);
      if (current !== correction.from) {
        problems.push(`${label}: date is ${current ?? "none"} now, the check saw ${correction.from ?? "none"}`);
        continue;
      }
      if (correction.from !== null && daysBetween(correction.from, correction.to) < minDays) {
        skipped++;
        continue;
      }
      updates.push(correction);
    }
  }

  return { updates, skipped, problems };
}

function report(plan: Plan, corrections: DateCorrection[], minDays: number) {
  const backfills = plan.updates.filter((update) => update.from === null).length;
  const changes = plan.updates.filter((update) => update.from !== null);
  const bucket = (label: string, test: (days: number) => boolean) =>
    console.log(`    ${label.padEnd(22)} ${changes.filter((update) => test(daysBetween(update.from!, update.to))).length}`);

  console.log(`Corrections listed: ${corrections.length}`);
  console.log(`Updates planned: ${plan.updates.length}`);
  console.log(`  backfills (no date before): ${backfills}`);
  console.log(`  changed dates: ${changes.length}`);
  bucket("1 day", (days) => days <= 1);
  bucket("2 to 31 days", (days) => days > 1 && days <= 31);
  bucket("32 days to 1 year", (days) => days > 31 && days <= 366);
  bucket("more than 1 year", (days) => days > 366);
  if (minDays > 0) console.log(`Skipped, under ${minDays} days apart: ${plan.skipped}`);
  if (plan.problems.length > 0) {
    console.log(`\nProblems (${plan.problems.length}), nothing will be updated until these are resolved:`);
    for (const problem of plan.problems.slice(0, 50)) console.log(`  ${problem}`);
    if (plan.problems.length > 50) console.log(`  ... and ${plan.problems.length - 50} more`);
  }
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

  console.log("=== Fix Edition Release Dates ===\n");
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

      let count = 0;
      for (let index = 0; index < plan.updates.length; index += BATCH_SIZE) {
        const batch = plan.updates.slice(index, index + BATCH_SIZE);
        const rows = Prisma.join(batch.map((update) => Prisma.sql`(${update.gameId}, ${update.to}::date)`));
        // Prisma keeps timestamps in UTC, whatever the session's time zone
        const result = await tx.$executeRaw`
          UPDATE "Game" AS g
          SET "releaseDate" = v.release_date, "updatedAt" = NOW() AT TIME ZONE 'UTC'
          FROM (VALUES ${rows}) AS v(id, release_date)
          WHERE g.id = v.id
        `;
        if (result !== batch.length) {
          throw new Error(`Batch at ${index} updated ${result} rows, expected ${batch.length}. Rolled back.`);
        }
        count += result;
      }
      return count;
    },
    { timeout: 300_000 }
  );

  console.log(`\nUpdated ${updated} games.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
