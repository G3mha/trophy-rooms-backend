/**
 * Add Switch 2 editions of games the catalog has on Switch, from a review
 * sheet.
 *
 * import-platform-region.ts doesn't import these (CLAUDE.md wants the official
 * edition name and the edition's own cover, which IGDB rarely has), so it
 * lists them in scripts/data/switch-2-editions-to-add-*.csv. Each row's
 * edition_name is the name of the Switch 2 product in Nintendo's eShop:
 * "Standard" when it's sold under the game's own name, the suffix otherwise
 * ("Nintendo Switch 2 Edition", "Definitive Edition"). Rows marked "add" are
 * added: a Switch 2 Game in the family with that label, its switch_2_release
 * date, the row's IGDB id and, when switch_2_cover is set, that cover. The
 * family's Switch edition gets the family cover set explicitly when it has
 * none (CLAUDE.md, Nintendo Switch 2 Enhanced Editions). A label that doesn't
 * exist yet is created; "Nintendo Switch 2 Edition" uses the shared
 * nintendo-switch-2-edition label. Once applied, rows are marked "added", and
 * the script checks those editions exist. Rows marked "skip" are left alone.
 *
 * Everything is checked again inside the transaction: the script stops if a
 * family is gone, has no Switch edition, or already has a Switch 2 edition.
 *
 * Usage:
 *   npx tsx scripts/add-switch-2-editions.ts --sheet <file>           # dry run, prints the plan
 *   npx tsx scripts/add-switch-2-editions.ts --sheet <file> --apply   # adds, in one transaction
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { readReviewSheet } from "./lib/review-sheet.js";

const prisma = new PrismaClient();

const COLUMNS = ["family_slug", "switch_2_release", "igdb_game", "edition_name", "switch_2_cover"] as const;

// Labels shared across games, by name; any other name gets a slug from it
const LABEL_SLUGS: Record<string, string> = {
  Standard: "standard",
  "Nintendo Switch 2 Edition": "nintendo-switch-2-edition",
};

function labelSlug(name: string): string {
  return (
    LABEL_SLUGS[name] ??
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
}

interface Addition {
  familyId: string;
  family: string;
  label: string;
  releaseDate: Date | null;
  igdbId: number | null;
  coverUrl: string | null;
  switchEditionId: string;
  setSwitchCover: string | null;
}

async function buildPlan(db: Prisma.TransactionClient, path: string) {
  const rows = readReviewSheet(path, COLUMNS, ["add", "skip", "added"]);
  const switch2 = await db.platform.findUniqueOrThrow({ where: { slug: "switch-2" }, select: { id: true } });
  const additions: Addition[] = [];
  const problems: string[] = [];

  for (const { line, decision, values } of rows) {
    if (decision !== "add" && decision !== "added") continue;
    const family = await db.gameFamily.findUnique({
      where: { slug: values.family_slug },
      select: { id: true, coverUrl: true, games: { select: { id: true, coverUrl: true, platform: { select: { slug: true } } } } },
    });
    const label = `line ${line} ${values.family_slug}`;
    if (!family) {
      problems.push(`${label}: no such family`);
      continue;
    }
    const onSwitch2 = family.games.some((game) => game.platform?.slug === "switch-2");
    if (decision === "added") {
      if (!onSwitch2) problems.push(`${label}: marked added, but the family has no Switch 2 edition`);
      continue;
    }
    const switchEdition = family.games.find((game) => game.platform?.slug === "switch");
    if (!switchEdition) {
      problems.push(`${label}: the family has no Switch edition`);
      continue;
    }
    if (onSwitch2) {
      problems.push(`${label}: the family already has a Switch 2 edition`);
      continue;
    }
    if (!values.edition_name.trim()) {
      problems.push(`${label}: no edition_name`);
      continue;
    }
    if (values.switch_2_release && !/^\d{4}-\d{2}-\d{2}$/.test(values.switch_2_release)) {
      problems.push(`${label}: switch_2_release must be YYYY-MM-DD, got "${values.switch_2_release}"`);
      continue;
    }
    const igdbId = /#(\d+)/.exec(values.igdb_game)?.[1];
    additions.push({
      familyId: family.id,
      family: values.family_slug,
      label: values.edition_name.trim(),
      releaseDate: values.switch_2_release ? new Date(`${values.switch_2_release}T00:00:00.000Z`) : null,
      igdbId: igdbId ? Number(igdbId) : null,
      coverUrl: values.switch_2_cover.trim() || null,
      switchEditionId: switchEdition.id,
      setSwitchCover: switchEdition.coverUrl ? null : family.coverUrl,
    });
  }

  const labels = new Map<string, number>();
  for (const addition of additions) labels.set(addition.label, (labels.get(addition.label) ?? 0) + 1);
  console.log(`Switch 2 editions to add: ${additions.length}`);
  for (const [name, count] of labels) console.log(`  ${name.padEnd(28)} ${count}`);
  console.log(`  with their own cover: ${additions.filter((addition) => addition.coverUrl).length}`);
  console.log(`Switch editions given the family cover: ${additions.filter((addition) => addition.setSwitchCover).length}`);
  if (problems.length > 0) {
    console.log(`\nProblems (${problems.length}), nothing will be added until these are resolved:`);
    for (const problem of problems) console.log(`  ${problem}`);
  }
  return { additions, problems, switch2Id: switch2.id };
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const sheetIndex = args.indexOf("--sheet");
  const sheetPath = sheetIndex >= 0 ? args[sheetIndex + 1] : undefined;
  if (!sheetPath) {
    console.error("Usage: npx tsx scripts/add-switch-2-editions.ts --sheet <file> [--apply]");
    process.exitCode = 1;
    return;
  }

  console.log("=== Add Switch 2 Editions ===\n");
  console.log(`Mode: ${apply ? "apply" : "dry run"}`);
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    console.log(`Database host: ${new URL(databaseUrl).host}`);
  }
  console.log(`Sheet: ${sheetPath}\n`);

  if (!apply) {
    await buildPlan(prisma, sheetPath);
    console.log("\n[DRY RUN] Nothing was added. Run with --apply to add.");
    return;
  }

  const added = await prisma.$transaction(
    async (tx) => {
      const { additions, problems, switch2Id } = await buildPlan(tx, sheetPath);
      if (problems.length > 0) {
        throw new Error("Stopped before adding anything. See problems above.");
      }
      const versionIds = new Map<string, string>();
      for (const name of new Set(additions.map((addition) => addition.label))) {
        const slug = labelSlug(name);
        const version = await tx.gameVersion.upsert({ where: { slug }, update: {}, create: { name, slug }, select: { id: true, name: true } });
        if (version.name !== name) throw new Error(`Label ${slug} is named "${version.name}", not "${name}". Rolled back.`);
        versionIds.set(name, version.id);
      }
      for (const addition of additions) {
        await tx.game.create({
          data: {
            gameFamilyId: addition.familyId,
            platformId: switch2Id,
            releaseDate: addition.releaseDate,
            igdbId: addition.igdbId,
            coverUrl: addition.coverUrl,
            versions: { connect: { id: versionIds.get(addition.label)! } },
          },
        });
        if (addition.setSwitchCover) {
          await tx.game.update({ where: { id: addition.switchEditionId }, data: { coverUrl: addition.setSwitchCover } });
        }
      }
      return additions.length;
    },
    { timeout: 120_000 }
  );

  console.log(`\nAdded ${added} Switch 2 editions.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
