/**
 * Move editions to the platform they were actually released on.
 *
 * An import that trusted IGDB's platform list could file a last-gen game under
 * the console that only runs it through backward compatibility, and leave the
 * family without the platform it's sold on: Teravit is a PS4 game on the
 * PlayStation Store, but the catalog only had it on PS5. Deleting that edition
 * (fix-unreleased-editions.ts) would drop the game, so its platform is changed
 * instead, and its date is set to the release on the new platform.
 *
 * The moves come from a JSON list, kept in scripts/data/ once applied:
 *   [{ family, from, to, fromDate, releaseDate, igdb, evidence }]
 * where from and to are platform names, fromDate is the edition's date when
 * the list was made (null for none) and releaseDate its new date (null for
 * none). Everything is checked again inside the update transaction: the
 * script stops if the family doesn't have exactly one edition on "from", if
 * it already has one on "to", if the edition's date has changed since the
 * list was made, or if anything uses the edition (library, collection,
 * trophies, play sessions, buylist, per-edition release dates).
 *
 * Usage:
 *   npx tsx scripts/fix-edition-platforms.ts --moves <file>           # dry run, prints the plan
 *   npx tsx scripts/fix-edition-platforms.ts --moves <file> --apply   # moves, in one transaction
 */

import { readFileSync } from "node:fs";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface Move {
  family: string;
  from: string;
  to: string;
  fromDate: string | null;
  releaseDate: string | null;
  igdb: string;
  evidence: string;
}

function readMoves(path: string): Move[] {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Move[];
  const valid =
    Array.isArray(parsed) &&
    parsed.every(
      (move) =>
        typeof move?.family === "string" &&
        typeof move.from === "string" &&
        typeof move.to === "string" &&
        (move.fromDate === null || /^\d{4}-\d{2}-\d{2}$/.test(move.fromDate)) &&
        (move.releaseDate === null || /^\d{4}-\d{2}-\d{2}$/.test(move.releaseDate))
    );
  if (!valid) {
    throw new Error(`${path} must be [{ family, from, to, fromDate, releaseDate, igdb, evidence }] with dates as YYYY-MM-DD or null`);
  }
  return parsed;
}

interface Plan {
  updates: Array<{ gameId: string; platformId: string; releaseDate: Date | null }>;
  problems: string[];
}

async function buildPlan(db: Prisma.TransactionClient, moves: Move[]): Promise<Plan> {
  const plan: Plan = { updates: [], problems: [] };
  const day = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : null);

  for (const move of moves) {
    const label = `${move.family}: ${move.from} -> ${move.to}`;
    const target = await db.platform.findFirst({ where: { name: move.to }, select: { id: true } });
    if (!target) {
      plan.problems.push(`${label}: no platform named ${move.to}`);
      continue;
    }
    const editions = await db.game.findMany({
      where: { gameFamily: { slug: move.family } },
      select: { id: true, releaseDate: true, platformId: true, platform: { select: { name: true } }, _count: true },
    });
    const onFrom = editions.filter((game) => game.platform?.name === move.from);
    if (onFrom.length !== 1) {
      plan.problems.push(`${label}: expected 1 edition on ${move.from}, found ${onFrom.length}`);
      continue;
    }
    if (editions.some((game) => game.platformId === target.id)) {
      plan.problems.push(`${label}: the family already has a ${move.to} edition`);
      continue;
    }
    const edition = onFrom[0]!;
    if (day(edition.releaseDate) !== move.fromDate) {
      plan.problems.push(`${label}: dated ${day(edition.releaseDate) ?? "none"} now, the list saw ${move.fromDate ?? "none"}`);
      continue;
    }
    const { versions: _versions, ...uses } = edition._count;
    const used = Object.entries(uses).filter(([, count]) => count > 0);
    if (used.length > 0) {
      plan.problems.push(`${label}: in use (${used.map(([name, count]) => `${name} ${count}`).join(", ")})`);
      continue;
    }
    console.log(`  ${label}, ${move.fromDate ?? "no date"} -> ${move.releaseDate ?? "no date"} (${move.evidence})`);
    plan.updates.push({
      gameId: edition.id,
      platformId: target.id,
      releaseDate: move.releaseDate ? new Date(`${move.releaseDate}T00:00:00.000Z`) : null,
    });
  }

  console.log(`\nMoves planned: ${plan.updates.length}`);
  if (plan.problems.length > 0) {
    console.log(`Problems (${plan.problems.length}), nothing will be moved until these are resolved:`);
    for (const problem of plan.problems) console.log(`  ${problem}`);
  }
  return plan;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const movesIndex = args.indexOf("--moves");
  const movesPath = movesIndex >= 0 ? args[movesIndex + 1] : undefined;
  if (!movesPath) {
    console.error("Usage: npx tsx scripts/fix-edition-platforms.ts --moves <file> [--apply]");
    process.exitCode = 1;
    return;
  }
  const moves = readMoves(movesPath);

  console.log("=== Fix Edition Platforms ===\n");
  console.log(`Mode: ${apply ? "apply" : "dry run"}`);
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    console.log(`Database host: ${new URL(databaseUrl).host}`);
  }
  console.log(`Moves file: ${movesPath}`);
  console.log("");

  if (!apply) {
    await buildPlan(prisma, moves);
    console.log("\n[DRY RUN] Nothing was moved. Run with --apply to move.");
    return;
  }

  const moved = await prisma.$transaction(async (tx) => {
    const plan = await buildPlan(tx, moves);
    if (plan.problems.length > 0) {
      throw new Error("Stopped before moving anything. See problems above.");
    }
    for (const update of plan.updates) {
      await tx.game.update({
        where: { id: update.gameId },
        data: { platformId: update.platformId, releaseDate: update.releaseDate },
      });
    }
    return plan.updates.length;
  });

  console.log(`\nMoved ${moved} editions.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
