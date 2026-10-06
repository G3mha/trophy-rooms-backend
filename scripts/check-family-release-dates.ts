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
 * Each family is checked too, against its IGDB game's earliest shipped
 * Western release on any platform: the canonical first release, which the
 * importer also compares when deciding whether to reuse a same-titled family.
 * The family's IGDB game is the single game its editions matched, or, when no
 * edition matched one, the game whose slug matches the family's. Slugs come
 * second because importers add a suffix on collisions, so "dirty-harry-1" (the
 * 1990 NES game) normalizes like IGDB's "dirty-harry--1" (a cancelled 2007
 * game). A family whose editions matched several games is reported as
 * ambiguous. When a family date differs, the
 * check records which IGDB release our date matches: non-western-date,
 * unshipped-date (alpha, beta, cancelled or a patch), later-western (a
 * Western release that wasn't the first) or unmatched.
 *
 * --cancelled-out <file> writes the cancelled editions as JSON, the input
 * fix-unreleased-editions.ts takes. --dates-out <file> writes the backfill
 * and differs editions, and --family-dates-out <file> the backfill and differs
 * families, as JSON, the input fix-release-dates.ts takes.
 *
 * Usage:
 *   npx tsx scripts/check-family-release-dates.ts
 *   npx tsx scripts/check-family-release-dates.ts --family watch-dogs --family x10
 *   npx tsx scripts/check-family-release-dates.ts --family x10 --cancelled-out scripts/data/cancelled.json
 *   npx tsx scripts/check-family-release-dates.ts --all --dates-out scripts/data/release-dates.json
 *   npx tsx scripts/check-family-release-dates.ts --all --family-dates-out scripts/data/family-dates.json
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

type FamilyVerdict = "ok" | "backfill" | "differs" | "non-western" | "ambiguous" | "no-igdb-date" | "not-on-igdb";

const FAMILY_VERDICTS: FamilyVerdict[] = [
  "ok",
  "backfill",
  "differs",
  "non-western",
  "ambiguous",
  "no-igdb-date",
  "not-on-igdb",
];

// Which of the IGDB game's releases a differing family date matches
type DateMatch = "non-western-date" | "unshipped-date" | "later-western" | "unmatched";

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
  let familyDatesOut: string | undefined;
  args.forEach((arg, index) => {
    const next = args[index + 1];
    if (arg === "--family" && next) slugs.push(next);
    if (arg === "--cancelled-out" && next) cancelledOut = next;
    if (arg === "--dates-out" && next) datesOut = next;
    if (arg === "--family-dates-out" && next) familyDatesOut = next;
  });
  return { slugs, all: args.includes("--all"), cancelledOut, datesOut, familyDatesOut };
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

function matchOurDate(game: IGDBCandidate, ours: Date): DateMatch {
  const day = formatDate(ours);
  const sameDay = (game.release_dates ?? []).filter(
    (release) => release.date !== undefined && formatDate(new Date(release.date * 1000)) === day
  );
  if (sameDay.some((release) => isShippedRelease(release) && isWesternRelease(release))) return "later-western";
  if (sameDay.some((release) => isShippedRelease(release))) return "non-western-date";
  if (sameDay.length > 0) return "unshipped-date";
  return "unmatched";
}

async function main() {
  const { slugs: requestedSlugs, all, cancelledOut, datesOut, familyDatesOut } = parseArgs();

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
        id: true,
        title: true,
        slug: true,
        releaseDate: true,
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
  const familySummary = new Map<FamilyVerdict, number>();
  const familyDateCorrections: Array<{
    familyId: string;
    family: string;
    from: string | null;
    to: string;
    igdb: string;
    match: DateMatch | "backfill";
  }> = [];

  for (const family of families) {
    const candidates = candidatesByTitle.get(family.title) ?? [];
    const lines: string[] = [];
    // IGDB games the family's editions were matched to
    const editionGameIds = new Set<number>();

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
      const matchedGame = verdict === "ambiguous" ? undefined : earliest?.candidate ?? shippedCandidates[0];
      if (matchedGame) editionGameIds.add(matchedGame.id);
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

    const familySlugMatches = candidates.filter((candidate) => normalizeSlug(candidate.slug) === family.slug);
    const familyGame =
      editionGameIds.size === 1
        ? candidates.find((candidate) => editionGameIds.has(candidate.id))
        : editionGameIds.size === 0 && familySlugMatches.length === 1
          ? familySlugMatches[0]
          : undefined;

    let familyVerdict: FamilyVerdict;
    let firstWestern: { date: Date; human: string } | undefined;
    let match: DateMatch | undefined;
    if (!familyGame) {
      familyVerdict = candidates.length === 0 ? "not-on-igdb" : "ambiguous";
    } else {
      const shipped = (familyGame.release_dates ?? []).filter(isShippedRelease);
      firstWestern = shipped
        .filter(isWesternRelease)
        .map((release) => ({ date: new Date(release.date * 1000), human: release.human ?? "" }))
        .sort((a, b) => a.date.getTime() - b.date.getTime())[0];
      if (!firstWestern) {
        familyVerdict = shipped.length > 0 ? "non-western" : "no-igdb-date";
      } else if (!family.releaseDate) {
        familyVerdict = "backfill";
      } else if (
        formatDate(family.releaseDate) === formatDate(firstWestern.date) ||
        withinIgdbPrecision(family.releaseDate, firstWestern.date, firstWestern.human)
      ) {
        familyVerdict = "ok";
      } else {
        familyVerdict = "differs";
        match = matchOurDate(familyGame, family.releaseDate);
      }
    }

    familySummary.set(familyVerdict, (familySummary.get(familyVerdict) ?? 0) + 1);
    const familySource = familyGame
      ? `${familyGame.slug} #${familyGame.id}${firstWestern ? `, "${firstWestern.human}"` : ""}`
      : "";
    if (!all || familyVerdict !== "ok") {
      lines.unshift(
        `  ${"(family)".padEnd(22)} ours ${formatDate(family.releaseDate).padEnd(10)}  ` +
          `IGDB ${formatDate(firstWestern?.date ?? null).padEnd(10)}  ${familyVerdict.padEnd(12)}` +
          `${match ? ` (${match})` : ""}${familySource ? `  [${familySource}]` : ""}`
      );
    }
    if ((familyVerdict === "backfill" || familyVerdict === "differs") && firstWestern) {
      familyDateCorrections.push({
        familyId: family.id,
        family: family.slug,
        from: family.releaseDate ? formatDate(family.releaseDate) : null,
        to: formatDate(firstWestern.date),
        igdb: familySource,
        match: match ?? "backfill",
      });
    }

    if (lines.length > 0) {
      console.log(`${family.title} (${family.slug})`);
      for (const line of lines) console.log(line);
      console.log("");
    }
  }

  console.log(`Families checked: ${families.length}`);
  console.log("Editions:");
  for (const verdict of VERDICTS) {
    console.log(`  ${verdict.padEnd(13)} ${summary.get(verdict) ?? 0}`);
  }
  console.log("Families:");
  for (const verdict of FAMILY_VERDICTS) {
    console.log(`  ${verdict.padEnd(13)} ${familySummary.get(verdict) ?? 0}`);
  }
  const matches = new Map<string, number>();
  for (const correction of familyDateCorrections) matches.set(correction.match, (matches.get(correction.match) ?? 0) + 1);
  for (const [name, count] of matches) console.log(`    ${name.padEnd(17)} ${count}`);

  if (cancelledOut) {
    writeFileSync(cancelledOut, `${JSON.stringify(cancelledEditions, null, 2)}\n`);
    console.log(`\nWrote ${cancelledEditions.length} cancelled editions to ${cancelledOut}`);
  }
  if (datesOut) {
    writeFileSync(datesOut, `${JSON.stringify(dateCorrections, null, 2)}\n`);
    console.log(`\nWrote ${dateCorrections.length} date corrections to ${datesOut}`);
  }
  if (familyDatesOut) {
    writeFileSync(familyDatesOut, `${JSON.stringify(familyDateCorrections, null, 2)}\n`);
    console.log(`\nWrote ${familyDateCorrections.length} family date corrections to ${familyDatesOut}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
