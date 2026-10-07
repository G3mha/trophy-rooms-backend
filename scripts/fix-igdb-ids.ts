/**
 * Fill GameFamily.igdbId and Game.igdbId from a check-family-release-dates.ts
 * --igdb-ids-out file.
 *
 * Only empty ids are filled; an id already set is never overwritten, and a
 * different one in the file is reported. An edition with an edition label
 * other than Standard (Oblivion Remastered on Steam, Ghost of Tsushima
 * Director's Cut) is skipped too: it is often its own IGDB game under a
 * different title, while the check matched it by the family's title. A family id is unique, so when the
 * file gives one IGDB game to several families, or a family is given an id
 * another family already has, none of them get it: that usually means
 * duplicate families, which a person should merge. Those are reported and
 * skipped, not treated as problems.
 *
 * Everything is checked again inside the transaction: the script stops if a
 * game or family is gone or no longer matches the family (and platform) the
 * check saw. Updates run in batches and roll back if any batch touches a
 * different number of rows.
 *
 * Usage:
 *   npx tsx scripts/fix-igdb-ids.ts --ids <file>           # dry run, prints the plan
 *   npx tsx scripts/fix-igdb-ids.ts --ids <file> --apply   # fills, in one transaction
 */

import { readFileSync } from "node:fs";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BATCH_SIZE = 1000;

interface EditionId {
  gameId: string;
  family: string;
  platform: string;
  igdbId: number;
  igdb: string;
}

interface FamilyId {
  familyId: string;
  family: string;
  igdbId: number;
  igdb: string;
}

interface IdFile {
  families: FamilyId[];
  editions: EditionId[];
}

function readIds(path: string): IdFile {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<IdFile>;
  const valid =
    Array.isArray(parsed.families) &&
    Array.isArray(parsed.editions) &&
    parsed.families.every((entry) => typeof entry?.familyId === "string" && Number.isInteger(entry?.igdbId)) &&
    parsed.editions.every(
      (entry) => typeof entry?.gameId === "string" && typeof entry?.platform === "string" && Number.isInteger(entry?.igdbId)
    );
  if (!valid) {
    throw new Error(`${path} must be { families: [{ familyId, family, igdbId }], editions: [{ gameId, family, platform, igdbId }] }`);
  }
  return parsed as IdFile;
}

interface Plan {
  families: Array<{ id: string; igdbId: number }>;
  editions: Array<{ id: string; igdbId: number }>;
  alreadySet: number;
  skipped: string[];
  problems: string[];
}

async function buildPlan(db: Prisma.TransactionClient, ids: IdFile): Promise<Plan> {
  const plan: Plan = { families: [], editions: [], alreadySet: 0, skipped: [], problems: [] };

  for (let index = 0; index < ids.editions.length; index += BATCH_SIZE) {
    const chunk = ids.editions.slice(index, index + BATCH_SIZE);
    const games = await db.game.findMany({
      where: { id: { in: chunk.map((entry) => entry.gameId) } },
      select: {
        id: true,
        igdbId: true,
        gameFamily: { select: { slug: true } },
        platform: { select: { name: true } },
        versions: { select: { name: true } },
      },
    });
    const byId = new Map(games.map((game) => [game.id, game]));
    for (const entry of chunk) {
      const label = `${entry.family} / ${entry.platform}`;
      const game = byId.get(entry.gameId);
      if (!game) {
        plan.problems.push(`${label}: game ${entry.gameId} no longer exists`);
      } else if (game.gameFamily?.slug !== entry.family || game.platform?.name !== entry.platform) {
        plan.problems.push(`${label}: game ${entry.gameId} is now ${game.gameFamily?.slug ?? "no family"} / ${game.platform?.name ?? "no platform"}`);
      } else if (game.igdbId === entry.igdbId) {
        plan.alreadySet++;
      } else if (game.igdbId !== null) {
        plan.skipped.push(`${label}: already #${game.igdbId}, the check matched #${entry.igdbId} (${entry.igdb})`);
      } else if (game.versions.some((version) => version.name !== "Standard")) {
        plan.skipped.push(
          `${label}: has edition label ${game.versions.map((version) => version.name).filter((name) => name !== "Standard").join(", ")}; may be its own IGDB game`
        );
      } else {
        plan.editions.push({ id: game.id, igdbId: entry.igdbId });
      }
    }
  }

  // A family id is unique: one IGDB game claimed by several families is left
  // off all of them
  const claims = new Map<number, FamilyId[]>();
  for (const entry of ids.families) claims.set(entry.igdbId, [...(claims.get(entry.igdbId) ?? []), entry]);
  const taken = new Map(
    (
      await db.gameFamily.findMany({
        where: { igdbId: { in: Array.from(claims.keys()) } },
        select: { id: true, slug: true, igdbId: true },
      })
    ).map((family) => [family.igdbId!, family])
  );

  for (let index = 0; index < ids.families.length; index += BATCH_SIZE) {
    const chunk = ids.families.slice(index, index + BATCH_SIZE);
    const families = await db.gameFamily.findMany({
      where: { id: { in: chunk.map((entry) => entry.familyId) } },
      select: { id: true, slug: true, igdbId: true },
    });
    const byId = new Map(families.map((family) => [family.id, family]));
    for (const entry of chunk) {
      const label = `${entry.family} (family)`;
      const family = byId.get(entry.familyId);
      if (!family) {
        plan.problems.push(`${label}: family ${entry.familyId} no longer exists`);
        continue;
      }
      if (family.slug !== entry.family) {
        plan.problems.push(`${label}: family ${entry.familyId} is now ${family.slug}`);
        continue;
      }
      if (family.igdbId === entry.igdbId) {
        plan.alreadySet++;
        continue;
      }
      if (family.igdbId !== null) {
        plan.skipped.push(`${label}: already #${family.igdbId}, the check matched #${entry.igdbId} (${entry.igdb})`);
        continue;
      }
      const owner = taken.get(entry.igdbId);
      if (owner && owner.id !== family.id) {
        plan.skipped.push(`${label}: #${entry.igdbId} (${entry.igdb}) already belongs to ${owner.slug}; possible duplicate families`);
        continue;
      }
      const claimants = claims.get(entry.igdbId) ?? [];
      if (claimants.length > 1) {
        plan.skipped.push(
          `${label}: #${entry.igdbId} (${entry.igdb}) also matched ${claimants.filter((other) => other !== entry).map((other) => other.family).join(", ")}; possible duplicate families`
        );
        continue;
      }
      plan.families.push({ id: family.id, igdbId: entry.igdbId });
    }
  }

  return plan;
}

function report(plan: Plan, ids: IdFile) {
  console.log(`Ids listed: ${ids.families.length} families, ${ids.editions.length} editions`);
  console.log(`Already set: ${plan.alreadySet}`);
  console.log(`To fill: ${plan.families.length} families, ${plan.editions.length} editions`);
  if (plan.skipped.length > 0) {
    console.log(`Skipped (${plan.skipped.length}):`);
    for (const line of plan.skipped.slice(0, 40)) console.log(`  ${line}`);
    if (plan.skipped.length > 40) console.log(`  ... and ${plan.skipped.length - 40} more`);
  }
  if (plan.problems.length > 0) {
    console.log(`\nProblems (${plan.problems.length}), nothing will be filled until these are resolved:`);
    for (const line of plan.problems.slice(0, 40)) console.log(`  ${line}`);
    if (plan.problems.length > 40) console.log(`  ... and ${plan.problems.length - 40} more`);
  }
}

// Prisma keeps timestamps in UTC, whatever the session's time zone
async function fill(
  tx: Prisma.TransactionClient,
  table: "Game" | "GameFamily",
  rows: Array<{ id: string; igdbId: number }>
): Promise<number> {
  let count = 0;
  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    const batch = rows.slice(index, index + BATCH_SIZE);
    const values = Prisma.join(batch.map((row) => Prisma.sql`(${row.id}, ${row.igdbId}::int)`));
    const result = await tx.$executeRaw`
      UPDATE ${Prisma.raw(`"${table}"`)} AS t
      SET "igdbId" = v.igdb_id, "updatedAt" = NOW() AT TIME ZONE 'UTC'
      FROM (VALUES ${values}) AS v(id, igdb_id)
      WHERE t.id = v.id AND t."igdbId" IS NULL
    `;
    if (result !== batch.length) {
      throw new Error(`${table} batch at ${index} filled ${result} rows, expected ${batch.length}. Rolled back.`);
    }
    count += result;
  }
  return count;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const idsIndex = args.indexOf("--ids");
  const idsPath = idsIndex >= 0 ? args[idsIndex + 1] : undefined;
  if (!idsPath) {
    console.error("Usage: npx tsx scripts/fix-igdb-ids.ts --ids <file> [--apply]");
    process.exitCode = 1;
    return;
  }
  const ids = readIds(idsPath);

  console.log("=== Fix IGDB Ids ===\n");
  console.log(`Mode: ${apply ? "apply" : "dry run"}`);
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    console.log(`Database host: ${new URL(databaseUrl).host}`);
  }
  console.log(`Ids file: ${idsPath}`);
  console.log("");

  if (!apply) {
    report(await buildPlan(prisma, ids), ids);
    console.log("\n[DRY RUN] Nothing was filled. Run with --apply to fill.");
    return;
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const plan = await buildPlan(tx, ids);
      report(plan, ids);
      if (plan.problems.length > 0) {
        throw new Error("Stopped before filling anything. See problems above.");
      }
      const families = await fill(tx, "GameFamily", plan.families);
      const editions = await fill(tx, "Game", plan.editions);
      return { families, editions };
    },
    { timeout: 300_000 }
  );

  console.log(`\nFilled ${result.families} families and ${result.editions} editions.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
