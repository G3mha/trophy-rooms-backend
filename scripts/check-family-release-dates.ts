/**
 * Compare each edition's release date against IGDB. Read-only.
 *
 * Without arguments it checks every family that has two or more editions and
 * at least one without a release date. pickTrophyGames (src/lib/trophies.ts)
 * falls back to a family's earliest release, so these are the families where
 * that pick can go wrong.
 *
 * Importers add games to an existing family by title, so one family can hold
 * editions of different IGDB games that share a name (the 1990 NES Dirty
 * Harry and the cancelled 2007 one). Each edition is matched on its own
 * platform against every IGDB game with the family's title.
 *
 * Only releases that put the game on sale count (isShippedRelease in
 * src/lib/igdb.ts, shared with fix-family-release-dates.ts): cancelled,
 * alpha, beta and next-gen patch releases are skipped.
 *
 * Verdicts per edition:
 *   ok            our date matches IGDB's earliest shipped release on the platform
 *   backfill      we have no date, IGDB has one
 *   differs       we have a date, IGDB's earliest is different
 *   cancelled     IGDB lists the platform, but the release was cancelled
 *   no-igdb-date  IGDB lists the platform with no shipped release date
 *   not-on-igdb   no IGDB game with this title lists the platform
 *
 * --cancelled-out <file> writes the cancelled editions as JSON, the input
 * fix-cancelled-editions.ts takes.
 *
 * Usage:
 *   npx tsx scripts/check-family-release-dates.ts
 *   npx tsx scripts/check-family-release-dates.ts --family watch-dogs --family x10
 *   npx tsx scripts/check-family-release-dates.ts --family x10 --cancelled-out scripts/data/cancelled.json
 */

import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import {
  IGDB_PLATFORM_MAP,
  igdbRequest,
  isShippedRelease,
  type IGDBReleaseDate,
} from "../src/lib/igdb.js";

const prisma = new PrismaClient();

// Same alias as fix-family-release-dates.ts
const EXTRA_IGDB_PLATFORM_IDS: Record<string, number[]> = {
  windows: [6],
};

interface IGDBCandidate {
  id: number;
  name: string;
  slug: string;
  game_status?: { status: string };
  platforms?: { id: number }[];
  release_dates?: IGDBReleaseDate[];
}

type Verdict = "ok" | "backfill" | "differs" | "cancelled" | "no-igdb-date" | "not-on-igdb";

function parseArgs() {
  const args = process.argv.slice(2);
  const slugs: string[] = [];
  let cancelledOut: string | undefined;
  args.forEach((arg, index) => {
    const next = args[index + 1];
    if (arg === "--family" && next) slugs.push(next);
    if (arg === "--cancelled-out" && next) cancelledOut = next;
  });
  return { slugs, cancelledOut };
}

function formatDate(date: Date | null): string {
  return date ? date.toISOString().split("T")[0]! : "none";
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

async function findCandidates(title: string): Promise<IGDBCandidate[]> {
  const fields =
    "fields id, name, slug, game_status.status, platforms.id, release_dates.platform, release_dates.date, release_dates.human, release_dates.status.name;";
  const escaped = title.replace(/"/g, '\\"');
  const exact = await igdbRequest<IGDBCandidate[]>("games", `${fields} where name ~ "${escaped}"; limit 50;`);
  if (exact.length > 0) return exact;

  // Fall back to search, keeping only names equal up to case and punctuation
  await new Promise((resolve) => setTimeout(resolve, 250));
  const searched = await igdbRequest<IGDBCandidate[]>("games", `${fields} search "${escaped}"; limit 20;`);
  return searched.filter((game) => normalizeName(game.name) === normalizeName(title));
}

async function main() {
  const { slugs: requestedSlugs, cancelledOut } = parseArgs();

  console.log("=== Check Family Release Dates (read-only) ===\n");
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    console.log(`Database host: ${new URL(databaseUrl).host}\n`);
  }

  const families = (
    await prisma.gameFamily.findMany({
      where:
        requestedSlugs.length > 0
          ? { slug: { in: requestedSlugs } }
          : { games: { some: { releaseDate: null } } },
      select: {
        title: true,
        slug: true,
        games: {
          select: {
            releaseDate: true,
            platform: { select: { name: true, slug: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { title: "asc" },
    })
  ).filter((family) => requestedSlugs.length > 0 || family.games.length >= 2);

  const summary = new Map<Verdict, string[]>();
  const cancelledEditions: Array<{ family: string; platform: string; igdb: string }> = [];

  for (const family of families) {
    console.log(`${family.title} (${family.slug})`);
    const candidates = await findCandidates(family.title);
    await new Promise((resolve) => setTimeout(resolve, 250));

    for (const game of family.games) {
      const platformSlug = game.platform?.slug ?? "";
      const platformIds = new Set(
        IGDB_PLATFORM_MAP[platformSlug] ?? EXTRA_IGDB_PLATFORM_IDS[platformSlug] ?? []
      );
      const onPlatform = candidates.filter(
        (candidate) =>
          candidate.platforms?.some((platform) => platformIds.has(platform.id)) ||
          candidate.release_dates?.some((release) => release.platform !== undefined && platformIds.has(release.platform))
      );

      const releases = onPlatform.flatMap((candidate) =>
        (candidate.release_dates ?? [])
          .filter(isShippedRelease)
          .filter((release) => platformIds.has(release.platform))
          .map((release) => ({ candidate, date: new Date(release.date * 1000), human: release.human ?? "" }))
      );
      releases.sort((a, b) => a.date.getTime() - b.date.getTime());
      const earliest = releases[0];

      let verdict: Verdict;
      if (earliest) {
        if (!game.releaseDate) verdict = "backfill";
        else verdict = formatDate(game.releaseDate) === formatDate(earliest.date) ? "ok" : "differs";
      } else if (onPlatform.length === 0) {
        verdict = "not-on-igdb";
      } else if (
        onPlatform.every(
          (candidate) =>
            candidate.game_status?.status === "Cancelled" ||
            candidate.release_dates?.some(
              (release) =>
                release.platform !== undefined &&
                platformIds.has(release.platform) &&
                release.status?.name === "Cancelled"
            )
        )
      ) {
        verdict = "cancelled";
      } else {
        verdict = "no-igdb-date";
      }

      const source = earliest
        ? `${earliest.candidate.slug} #${earliest.candidate.id}, "${earliest.human}"`
        : onPlatform.map((candidate) => `${candidate.slug} #${candidate.id}${candidate.game_status ? ` ${candidate.game_status.status}` : ""}`).join("; ");
      console.log(
        `  ${(game.platform?.name ?? "no platform").padEnd(22)} ours ${formatDate(game.releaseDate).padEnd(10)}  ` +
          `IGDB ${formatDate(earliest?.date ?? null).padEnd(10)}  ${verdict.padEnd(12)}${source ? `  [${source}]` : ""}`
      );

      const entries = summary.get(verdict) ?? [];
      entries.push(`${family.title} / ${game.platform?.name ?? "no platform"}`);
      summary.set(verdict, entries);
      if (verdict === "cancelled" && game.platform) {
        cancelledEditions.push({ family: family.slug, platform: game.platform.name, igdb: source });
      }
    }
    console.log("");
  }

  console.log(`Families checked: ${families.length}`);
  for (const verdict of ["ok", "backfill", "differs", "cancelled", "no-igdb-date", "not-on-igdb"] as Verdict[]) {
    console.log(`  ${verdict.padEnd(13)} ${summary.get(verdict)?.length ?? 0}`);
  }

  if (cancelledOut) {
    writeFileSync(cancelledOut, `${JSON.stringify(cancelledEditions, null, 2)}\n`);
    console.log(`\nWrote ${cancelledEditions.length} cancelled editions to ${cancelledOut}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
