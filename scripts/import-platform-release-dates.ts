/**
 * Add launch dates (PlatformRelease rows) for every platform.
 *
 * BuylistItem.displayPlatform shows a DLC's or bundle's first-launched
 * platform, which needs these dates. Consoles and handhelds come from IGDB:
 * the regional release dates of the platform's original hardware ("Initial
 * version"), or of all its versions when IGDB doesn't name one. Dates IGDB
 * only knows to the month or year are skipped, since IGDB stores them as the
 * last day of the period. PC, operating systems and storefronts aren't
 * hardware with regional launches, so they get one worldwide date from the
 * table below.
 *
 * Regions follow the admin form: NA, EU, JP, AU, WW (worldwide), and OTHER
 * for any other region, keeping the earliest date. It only adds missing
 * (platform, region) rows. An existing row is left as is, even when its date
 * differs, and reported.
 *
 * Usage:
 *   npx tsx scripts/import-platform-release-dates.ts           # dry run, prints the plan
 *   npx tsx scripts/import-platform-release-dates.ts --apply   # creates the missing rows
 */

import { PrismaClient } from "@prisma/client";
import { igdbRequest, IGDB_PLATFORM_MAP } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

// One worldwide date for platforms IGDB doesn't model as regional hardware.
// Sources as of 2026-10-05.
const WORLDWIDE_RELEASES: Record<string, { date: string; source: string }> = {
  pc: { date: "1985-11-20", source: "IGDB PC (Microsoft Windows), Windows 1.0" },
  windows: { date: "1985-11-20", source: "IGDB PC (Microsoft Windows), Windows 1.0" },
  macos: { date: "2001-03-24", source: "IGDB Mac, Mac OS X 10.0 Cheetah" },
  linux: { date: "1991-09-17", source: "IGDB Linux" },
  ios: { date: "2007-06-29", source: "IGDB iOS" },
  // IGDB's Android versions start at 2.2 (2010)
  android: { date: "2008-09-23", source: "Wikipedia, Android version history: Android 1.0" },
  steam: { date: "2003-09-12", source: "Wikipedia, Steam (service): out of beta" },
  epic: { date: "2018-12-06", source: "Wikipedia, Epic Games Store" },
  gog: { date: "2008-10-23", source: "GOG.com press release, open to the public (via GameBanshee)" },
};

// IGDB rows known to be wrong, replaced by a sourced date
const CORRECTIONS: Record<string, Record<string, { date: string; source: string }>> = {
  // IGDB has Wii Australia on 2006-02-07, ten months before any Wii launch
  wii: { AU: { date: "2006-12-07", source: "Wikipedia, Wii: Australia release" } },
};

// IGDB versions that are separate devices, not a revision of the platform's
// hardware. Platforms without an "Initial version" use all their versions,
// since IGDB splits some originals by region (Super Famicom and SNES).
const SKIP_VERSIONS = new Set([
  "PlayStation TV", // listed under PlayStation Vita
]);

// IGDB release_region ids; anything else (NZ, China, Asia, Korea, Brazil) is OTHER
const REGION_BY_IGDB_ID: Record<number, string> = { 1: "EU", 2: "NA", 3: "AU", 5: "JP", 8: "WW" };

// IGDB's `human` for a release known to the day, e.g. "Nov 19, 2006"
const FULL_DAY = /^[A-Z][a-z]{2} \d{2}, \d{4}$/;

type IGDBPlatform = {
  id: number;
  name: string;
  versions?: Array<{
    name: string;
    platform_version_release_dates?: Array<{
      date?: number;
      human?: string;
      release_region?: number;
      region?: number;
    }>;
  }>;
};

type PlannedRelease = { region: string; date: string; source: string };

function igdbReleases(platform: IGDBPlatform): PlannedRelease[] {
  const versions = (platform.versions ?? []).filter((version) => !SKIP_VERSIONS.has(version.name));
  const initial = versions.filter((version) => version.name === "Initial version");
  const earliest = new Map<string, PlannedRelease>();

  for (const version of initial.length > 0 ? initial : versions) {
    for (const release of version.platform_version_release_dates ?? []) {
      if (!release.date || !FULL_DAY.test(release.human ?? "")) continue;
      const regionId = release.release_region ?? release.region ?? 0;
      const region = REGION_BY_IGDB_ID[regionId] ?? "OTHER";
      const date = new Date(release.date * 1000).toISOString().slice(0, 10);
      const current = earliest.get(region);
      if (!current || date < current.date) {
        earliest.set(region, { region, date, source: `IGDB ${platform.name}, ${version.name}` });
      }
    }
  }

  return [...earliest.values()];
}

async function main() {
  const apply = process.argv.slice(2).includes("--apply");

  console.log("=== Import Platform Release Dates ===\n");
  console.log(`Mode: ${apply ? "apply" : "dry run"}`);
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    console.log(`Database host: ${new URL(databaseUrl).host}`);
  }
  console.log("");

  const platforms = await prisma.platform.findMany({
    select: { id: true, slug: true, name: true, releases: { select: { region: true, releaseDate: true } } },
    orderBy: { name: "asc" },
  });

  const igdbIds = [
    ...new Set(
      platforms
        .filter((platform) => !WORLDWIDE_RELEASES[platform.slug])
        .flatMap((platform) => IGDB_PLATFORM_MAP[platform.slug] ?? [])
    ),
  ];
  const igdbPlatforms =
    igdbIds.length === 0
      ? []
      : await igdbRequest<IGDBPlatform[]>(
          "platforms",
          `fields name, versions.name,
             versions.platform_version_release_dates.date,
             versions.platform_version_release_dates.human,
             versions.platform_version_release_dates.release_region,
             versions.platform_version_release_dates.region;
           where id = (${igdbIds.join(",")}); limit 500;`
        );
  const igdbById = new Map(igdbPlatforms.map((platform) => [platform.id, platform]));

  const toCreate: Array<{ platformId: string; region: string; releaseDate: Date }> = [];
  const unresolved: string[] = [];
  let existingCount = 0;

  for (const platform of platforms) {
    let planned: PlannedRelease[];
    const worldwide = WORLDWIDE_RELEASES[platform.slug];
    if (worldwide) {
      planned = [{ region: "WW", ...worldwide }];
    } else {
      // A slug mapped to several IGDB platforms has no single launch to take
      const [igdbId, ...otherIds] = IGDB_PLATFORM_MAP[platform.slug] ?? [];
      const igdbPlatform =
        igdbId !== undefined && otherIds.length === 0 ? igdbById.get(igdbId) : undefined;
      if (!igdbPlatform) {
        unresolved.push(`${platform.name} (${platform.slug})`);
        continue;
      }
      planned = igdbReleases(igdbPlatform);
      for (const [region, correction] of Object.entries(CORRECTIONS[platform.slug] ?? {})) {
        planned = planned.filter((release) => release.region !== region);
        planned.push({ region, ...correction });
      }
    }

    planned.sort((a, b) => a.date.localeCompare(b.date));
    console.log(`${platform.name} (${platform.slug})`);
    if (planned.length === 0) {
      console.log("  no dated releases found");
      unresolved.push(`${platform.name} (${platform.slug})`);
      continue;
    }

    for (const release of planned) {
      const existing = platform.releases.find((row) => row.region === release.region);
      if (existing) {
        existingCount++;
        const existingDate = existing.releaseDate.toISOString().slice(0, 10);
        const note = existingDate === release.date ? "already set" : `keeps existing ${existingDate}`;
        console.log(`  = ${release.region.padEnd(5)} ${release.date}  ${note}`);
        continue;
      }
      toCreate.push({
        platformId: platform.id,
        region: release.region,
        releaseDate: new Date(`${release.date}T00:00:00.000Z`),
      });
      console.log(`  + ${release.region.padEnd(5)} ${release.date}  ${release.source}`);
    }
  }

  console.log(`\nPlatforms: ${platforms.length}`);
  console.log(`Releases to create: ${toCreate.length}`);
  console.log(`Releases already present: ${existingCount}`);
  if (unresolved.length > 0) {
    console.log(`No dates found for: ${unresolved.join(", ")}`);
  }

  if (!apply) {
    console.log("\n[DRY RUN] Nothing was written. Run with --apply to create the releases.");
    return;
  }

  // skipDuplicates covers a row added between the read above and this write
  const result = await prisma.platformRelease.createMany({ data: toCreate, skipDuplicates: true });
  console.log(`\nCreated ${result.count} releases.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
