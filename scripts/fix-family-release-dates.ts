/**
 * Fill in missing release dates for one GameFamily from IGDB.
 *
 * Each Game gets the earliest IGDB release date on its platform, in any
 * region. The family gets IGDB's first_release_date. Only null dates are
 * filled: dates already set are never overwritten, and games IGDB has no
 * release for on their platform are reported and left alone.
 *
 * pickTrophyGames (src/lib/trophies.ts) falls back to a family's earliest
 * release, so families without dates fall through to import order.
 *
 * Usage:
 *   npx tsx scripts/fix-family-release-dates.ts --family hotline-miami
 *   npx tsx scripts/fix-family-release-dates.ts --family hotline-miami --apply
 *   npx tsx scripts/fix-family-release-dates.ts --family <slug> --igdb <igdb-slug>
 */

import { PrismaClient } from "@prisma/client";
import { IGDB_PLATFORM_MAP, fetchGameBySlug, igdbRequest } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

// Platform slugs in the database that IGDB_PLATFORM_MAP doesn't list. Kept
// here rather than in the shared map, which seed-all-platforms.ts iterates.
const EXTRA_IGDB_PLATFORM_IDS: Record<string, number[]> = {
  windows: [6],
};

interface IGDBReleaseDate {
  platform?: number;
  date?: number;
  human?: string;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const valueOf = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };
  return {
    apply: args.includes("--apply"),
    familySlug: valueOf("--family"),
    igdbSlug: valueOf("--igdb"),
  };
}

function formatDate(date: Date | null): string {
  return date ? date.toISOString().split("T")[0]! : "none";
}

async function main() {
  const { apply, familySlug, igdbSlug } = parseArgs();
  if (!familySlug) {
    console.error("Usage: npx tsx scripts/fix-family-release-dates.ts --family <slug> [--igdb <igdb-slug>] [--apply]");
    process.exitCode = 1;
    return;
  }

  console.log("=== Fix Family Release Dates ===\n");
  console.log(`Mode: ${apply ? "apply" : "dry run"}`);
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    console.log(`Database host: ${new URL(databaseUrl).host}`);
  }
  console.log("");

  const family = await prisma.gameFamily.findUnique({
    where: { slug: familySlug },
    select: {
      id: true,
      title: true,
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
  });
  if (!family) {
    console.error(`No game family with slug "${familySlug}".`);
    process.exitCode = 1;
    return;
  }

  const igdbGame = await fetchGameBySlug(igdbSlug ?? familySlug);
  if (!igdbGame) {
    console.error(`No IGDB game with slug "${igdbSlug ?? familySlug}". Pass --igdb <slug>.`);
    process.exitCode = 1;
    return;
  }
  const firstRelease = igdbGame.first_release_date
    ? new Date(igdbGame.first_release_date * 1000)
    : null;
  console.log(`Family: ${family.title} (${familySlug})`);
  console.log(`IGDB:   ${igdbGame.name} (${igdbGame.slug}, id ${igdbGame.id}), first release ${formatDate(firstRelease)}\n`);

  const releaseDates = await igdbRequest<IGDBReleaseDate[]>(
    "release_dates",
    `fields platform, date, human; where game = ${igdbGame.id}; sort date asc; limit 500;`
  );
  const earliestByIgdbPlatform = new Map<number, Date>();
  for (const release of releaseDates) {
    if (release.platform === undefined || release.date === undefined) continue;
    if (!earliestByIgdbPlatform.has(release.platform)) {
      earliestByIgdbPlatform.set(release.platform, new Date(release.date * 1000));
    }
  }

  const gameUpdates: Array<{ id: string; releaseDate: Date }> = [];
  for (const game of family.games) {
    const platformSlug = game.platform?.slug;
    const label = (game.platform?.name ?? "no platform").padEnd(18);
    const igdbPlatformIds = platformSlug
      ? IGDB_PLATFORM_MAP[platformSlug] ?? EXTRA_IGDB_PLATFORM_IDS[platformSlug] ?? []
      : [];
    const candidates = igdbPlatformIds
      .map((id) => earliestByIgdbPlatform.get(id))
      .filter((date): date is Date => date !== undefined);
    const igdbDate = candidates.length > 0
      ? new Date(Math.min(...candidates.map((date) => date.getTime())))
      : null;

    if (game.releaseDate) {
      console.log(`  ${label} keep ${formatDate(game.releaseDate)} (already set; IGDB ${formatDate(igdbDate)})`);
    } else if (igdbPlatformIds.length === 0) {
      console.log(`  ${label} skip: no IGDB platform mapping for slug "${platformSlug}"`);
    } else if (!igdbDate) {
      console.log(`  ${label} skip: IGDB has no release on this platform`);
    } else {
      console.log(`  ${label} set  ${formatDate(igdbDate)}`);
      gameUpdates.push({ id: game.id, releaseDate: igdbDate });
    }
  }

  const setFamilyDate = !family.releaseDate && firstRelease !== null;
  console.log(
    `\n  Family release     ${
      family.releaseDate
        ? `keep ${formatDate(family.releaseDate)} (already set)`
        : setFamilyDate
          ? `set  ${formatDate(firstRelease)}`
          : "skip: IGDB has no first release date"
    }`
  );

  console.log(`\nGames to update: ${gameUpdates.length} of ${family.games.length}`);

  if (!apply) {
    console.log("\n[DRY RUN] Nothing was written. Run with --apply to write.");
    return;
  }

  if (gameUpdates.length === 0 && !setFamilyDate) {
    console.log("\nNothing to write.");
    return;
  }

  await prisma.$transaction([
    ...gameUpdates.map((update) =>
      prisma.game.update({
        where: { id: update.id },
        data: { releaseDate: update.releaseDate },
      })
    ),
    ...(setFamilyDate
      ? [prisma.gameFamily.update({ where: { id: family.id }, data: { releaseDate: firstRelease } })]
      : []),
  ]);

  console.log(`\nUpdated ${gameUpdates.length} games${setFamilyDate ? " and the family" : ""}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
