/**
 * Compare each edition's release date against IGDB. Read-only.
 *
 * Editions are dated by their earliest shipped Western release on their own
 * platform (WESTERN_RELEASE_REGION_IDS in src/lib/igdb.ts), the same rule
 * import-platform-region.ts uses. Only releases that put the game on sale
 * count (isShippedRelease, shared with fix-family-release-dates.ts):
 * cancelled, alpha, beta and next-gen patch releases are skipped.
 *
 * Without arguments it checks every family that has two or more editions and
 * at least one without a release date. pickTrophyGames (src/lib/trophies.ts)
 * falls back to a family's earliest release, so these are the families where
 * that pick can go wrong. --family limits it to the families named, and --all
 * checks the whole catalog (looking titles up in batches and printing only
 * editions that aren't ok).
 *
 * Importers add games to an existing family by title, so one family can hold
 * editions of different IGDB games that share a name (the 1990 NES Dirty
 * Harry and the cancelled 2007 one), and IGDB itself has many same-titled
 * games (17 called "Doom"). Each edition is matched on its own platform. When
 * an IGDB game's slug matches the family's slug, only that game is used;
 * otherwise, if more than one same-titled game shipped on the platform, the
 * edition is reported as ambiguous and left alone.
 *
 * Verdicts per edition:
 *   ok            our date matches IGDB's earliest Western release on the platform,
 *                 or falls inside it when IGDB only has a year, quarter or month
 *   backfill      we have no date, IGDB has one
 *   differs       we have a date, IGDB's earliest Western release is different
 *   non-western   it shipped on the platform, but only outside the West; our date stays
 *   ambiguous     several same-titled IGDB games shipped on the platform
 *   cancelled     IGDB lists the platform, but the release (or game) was cancelled
 *   no-igdb-date  IGDB lists the platform with no shipped release date
 *   not-on-igdb   no IGDB game with this title lists the platform
 *
 * Cancelled looks at every region, so a game that shipped in Japan and was
 * cancelled in the West is never reported as cancelled.
 *
 * --cancelled-out <file> writes the cancelled editions as JSON, the input
 * fix-unreleased-editions.ts takes. --dates-out <file> writes the backfill
 * and differs editions as JSON, the input fix-edition-release-dates.ts takes.
 *
 * Usage:
 *   npx tsx scripts/check-family-release-dates.ts
 *   npx tsx scripts/check-family-release-dates.ts --family watch-dogs --family x10
 *   npx tsx scripts/check-family-release-dates.ts --family x10 --cancelled-out scripts/data/cancelled.json
 *   npx tsx scripts/check-family-release-dates.ts --all --dates-out scripts/data/release-dates.json
 */

import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import {
  IGDB_PLATFORM_MAP,
  igdbRequest,
  isShippedRelease,
  isWesternRelease,
  type IGDBReleaseDate,
} from "../src/lib/igdb.js";

const prisma = new PrismaClient();

// Same alias as fix-family-release-dates.ts
const EXTRA_IGDB_PLATFORM_IDS: Record<string, number[]> = {
  windows: [6],
};

const CANDIDATE_FIELDS =
  "fields id, name, slug, game_status.status, platforms.id, release_dates.platform, release_dates.date, release_dates.human, release_dates.release_region, release_dates.status.name;";
const TITLES_PER_REQUEST = 50;
const PAGE_SIZE = 500;

interface IGDBCandidate {
  id: number;
  name: string;
  slug: string;
  game_status?: { status: string };
  platforms?: { id: number }[];
  release_dates?: IGDBReleaseDate[];
}

type Verdict =
  | "ok"
  | "backfill"
  | "differs"
  | "non-western"
  | "ambiguous"
  | "cancelled"
  | "no-igdb-date"
  | "not-on-igdb";

const VERDICTS: Verdict[] = [
  "ok",
  "backfill",
  "differs",
  "non-western",
  "ambiguous",
  "cancelled",
  "no-igdb-date",
  "not-on-igdb",
];

function parseArgs() {
  const args = process.argv.slice(2);
  const slugs: string[] = [];
  let cancelledOut: string | undefined;
  let datesOut: string | undefined;
  args.forEach((arg, index) => {
    const next = args[index + 1];
    if (arg === "--family" && next) slugs.push(next);
    if (arg === "--cancelled-out" && next) cancelledOut = next;
    if (arg === "--dates-out" && next) datesOut = next;
  });
  return { slugs, all: args.includes("--all"), cancelledOut, datesOut };
}

const sleep = () => new Promise((resolve) => setTimeout(resolve, 250));

function formatDate(date: Date | null): string {
  return date ? date.toISOString().split("T")[0]! : "none";
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// Importers built family slugs from IGDB slugs with runs of non-alphanumerics
// collapsed, so IGDB's "doom--9" became "doom-9"
function normalizeSlug(slug: string): string {
  return slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function quote(title: string): string {
  return `"${title.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

// Exact, case-sensitive names, many titles per request. Family titles mostly
// came from IGDB names, so this finds most of them.
async function findCandidatesByExactNames(titles: string[]): Promise<Map<string, IGDBCandidate[]>> {
  const byName = new Map<string, IGDBCandidate[]>();
  for (let index = 0; index < titles.length; index += TITLES_PER_REQUEST) {
    const chunk = titles.slice(index, index + TITLES_PER_REQUEST);
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const games = await igdbRequest<IGDBCandidate[]>(
        "games",
        `${CANDIDATE_FIELDS} where name = (${chunk.map(quote).join(", ")}); limit ${PAGE_SIZE}; offset ${offset};`
      );
      for (const game of games) {
        byName.set(game.name, [...(byName.get(game.name) ?? []), game]);
      }
      await sleep();
      if (games.length < PAGE_SIZE) break;
    }
    process.stderr.write(`\r   Looked up ${Math.min(index + TITLES_PER_REQUEST, titles.length)}/${titles.length} titles...`);
  }
  process.stderr.write("\n");
  return byName;
}

// One title at a time: case-insensitive exact name, then search, keeping only
// names equal up to case and punctuation
async function findCandidates(title: string): Promise<IGDBCandidate[]> {
  const escaped = quote(title);
  const exact = await igdbRequest<IGDBCandidate[]>("games", `${CANDIDATE_FIELDS} where name ~ ${escaped}; limit 50;`);
  if (exact.length > 0) return exact;

  await sleep();
  const searched = await igdbRequest<IGDBCandidate[]>("games", `${CANDIDATE_FIELDS} search ${escaped}; limit 20;`);
  return searched.filter((game) => normalizeName(game.name) === normalizeName(title));
}

// Whether our date falls inside an IGDB date that only has a year, quarter
// or month ("1990", "Q4 2000", "Dec 1990"), which IGDB stores as the last day
function withinIgdbPrecision(ours: Date, igdbDate: Date, human: string): boolean {
  const year = ours.getUTCFullYear();
  if (/^\d{4}$/.test(human)) return year === igdbDate.getUTCFullYear();
  const quarter = human.match(/^Q([1-4]) (\d{4})$/);
  if (quarter) return year === Number(quarter[2]) && Math.floor(ours.getUTCMonth() / 3) + 1 === Number(quarter[1]);
  if (/^[A-Z][a-z]{2} \d{4}$/.test(human)) {
    return year === igdbDate.getUTCFullYear() && ours.getUTCMonth() === igdbDate.getUTCMonth();
  }
  return false;
}

async function main() {
  const { slugs: requestedSlugs, all, cancelledOut, datesOut } = parseArgs();

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
          : all
            ? { games: { some: {} } }
            : { games: { some: { releaseDate: null } } },
      select: {
        title: true,
        slug: true,
        games: {
          select: {
            id: true,
            releaseDate: true,
            platform: { select: { name: true, slug: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { title: "asc" },
    })
  ).filter((family) => requestedSlugs.length > 0 || all || family.games.length >= 2);

  const titles = Array.from(new Set(families.map((family) => family.title)));
  const candidatesByTitle = all ? await findCandidatesByExactNames(titles) : new Map<string, IGDBCandidate[]>();
  const missing = titles.filter((title) => !candidatesByTitle.has(title));
  for (const [index, title] of missing.entries()) {
    candidatesByTitle.set(title, await findCandidates(title));
    await sleep();
    if (all) process.stderr.write(`\r   Looked up ${index + 1}/${missing.length} titles one at a time...`);
  }
  if (all && missing.length > 0) process.stderr.write("\n");

  const summary = new Map<Verdict, number>();
  const cancelledEditions: Array<{ family: string; platform: string; igdb: string }> = [];
  const dateCorrections: Array<{
    gameId: string;
    family: string;
    platform: string;
    from: string | null;
    to: string;
    igdb: string;
  }> = [];

  for (const family of families) {
    const candidates = candidatesByTitle.get(family.title) ?? [];
    const lines: string[] = [];

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
      const shippedOnPlatform = (candidate: IGDBCandidate) =>
        (candidate.release_dates ?? [])
          .filter(isShippedRelease)
          .filter((release) => platformIds.has(release.platform));

      const slugMatched = onPlatform.filter((candidate) => normalizeSlug(candidate.slug) === family.slug);
      const pool = slugMatched.length === 1 ? slugMatched : onPlatform;
      const shippedCandidates = pool.filter((candidate) => shippedOnPlatform(candidate).length > 0);

      const western = pool
        .flatMap((candidate) =>
          shippedOnPlatform(candidate)
            .filter(isWesternRelease)
            .map((release) => ({ candidate, date: new Date(release.date * 1000), human: release.human ?? "" }))
        )
        .sort((a, b) => a.date.getTime() - b.date.getTime());
      const earliest = western[0];

      let verdict: Verdict;
      if (shippedCandidates.length > 1) {
        verdict = "ambiguous";
      } else if (earliest) {
        if (!game.releaseDate) verdict = "backfill";
        else if (formatDate(game.releaseDate) === formatDate(earliest.date)) verdict = "ok";
        else if (withinIgdbPrecision(game.releaseDate, earliest.date, earliest.human)) verdict = "ok";
        else verdict = "differs";
      } else if (shippedCandidates.length === 1) {
        verdict = "non-western";
      } else if (onPlatform.length === 0) {
        verdict = "not-on-igdb";
      } else if (
        pool.every(
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

      const source =
        earliest && verdict !== "ambiguous"
          ? `${earliest.candidate.slug} #${earliest.candidate.id}, "${earliest.human}"`
          : (verdict === "ambiguous" ? shippedCandidates : pool)
              .map((candidate) => `${candidate.slug} #${candidate.id}${candidate.game_status ? ` ${candidate.game_status.status}` : ""}`)
              .join("; ");
      if (!all || verdict !== "ok") {
        lines.push(
          `  ${(game.platform?.name ?? "no platform").padEnd(22)} ours ${formatDate(game.releaseDate).padEnd(10)}  ` +
            `IGDB ${formatDate(verdict === "ambiguous" ? null : earliest?.date ?? null).padEnd(10)}  ${verdict.padEnd(12)}${source ? `  [${source}]` : ""}`
        );
      }

      summary.set(verdict, (summary.get(verdict) ?? 0) + 1);
      if (verdict === "cancelled" && game.platform) {
        cancelledEditions.push({ family: family.slug, platform: game.platform.name, igdb: source });
      }
      if ((verdict === "backfill" || verdict === "differs") && earliest && game.platform) {
        dateCorrections.push({
          gameId: game.id,
          family: family.slug,
          platform: game.platform.name,
          from: game.releaseDate ? formatDate(game.releaseDate) : null,
          to: formatDate(earliest.date),
          igdb: source,
        });
      }
    }

    if (lines.length > 0) {
      console.log(`${family.title} (${family.slug})`);
      for (const line of lines) console.log(line);
      console.log("");
    }
  }

  console.log(`Families checked: ${families.length}`);
  for (const verdict of VERDICTS) {
    console.log(`  ${verdict.padEnd(13)} ${summary.get(verdict) ?? 0}`);
  }

  if (cancelledOut) {
    writeFileSync(cancelledOut, `${JSON.stringify(cancelledEditions, null, 2)}\n`);
    console.log(`\nWrote ${cancelledEditions.length} cancelled editions to ${cancelledOut}`);
  }
  if (datesOut) {
    writeFileSync(datesOut, `${JSON.stringify(dateCorrections, null, 2)}\n`);
    console.log(`\nWrote ${dateCorrections.length} date corrections to ${datesOut}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
