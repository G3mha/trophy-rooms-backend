import { PrismaClient, GameType } from "@prisma/client";
import {
  igdbRequest,
  getCoverUrl,
  IGDBGameCategory,
  IGDB_PLATFORM_MAP,
  type IGDBGame,
} from "../src/lib/igdb.js";

const prisma = new PrismaClient();

const REGION_ALIASES: Record<string, string> = {
  na: "north-america",
  northamerica: "north-america",
  "north-america": "north-america",
  us: "north-america",
  usa: "north-america",
};

interface IGDBRegion {
  id: number;
  name: string;
}

interface IGDBReleaseDate {
  game: number;
  date?: number;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    platform: "gba",
    region: "north-america",
    limit: undefined as number | undefined,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    if ((arg === "--platform" || arg === "-p") && next) {
      options.platform = next.trim().toLowerCase();
      i++;
      continue;
    }

    if ((arg === "--region" || arg === "-r") && next) {
      options.region = next.trim().toLowerCase();
      i++;
      continue;
    }

    if ((arg === "--limit" || arg === "-l") && next) {
      const parsed = Number.parseInt(next, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.limit = parsed;
      }
      i++;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }

  options.region = REGION_ALIASES[options.region] ?? options.region;
  return options;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);
}

async function ensureUniqueGameFamilySlug(preferredSlug: string): Promise<string> {
  let slug = preferredSlug;
  let counter = 1;

  while (await prisma.gameFamily.findUnique({ where: { slug } })) {
    slug = `${preferredSlug}-${counter}`;
    counter++;
  }

  return slug;
}

async function ensureStandardVersion() {
  let standardVersion = await prisma.gameVersion.findFirst({
    where: { slug: "standard" },
  });

  if (!standardVersion) {
    standardVersion = await prisma.gameVersion.create({
      data: {
        name: "Standard",
        slug: "standard",
        isDefault: true,
      },
    });
  }

  return standardVersion;
}

async function fetchRegionBySlug(regionSlug: string): Promise<IGDBRegion | null> {
  const normalizedRegionName = regionSlug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  const escapedRegionName = normalizedRegionName.replace(/"/g, '\\"');
  const query = `
    fields id, name;
    where name = "${escapedRegionName}";
    limit 10;
  `;

  const results = await igdbRequest<IGDBRegion[]>("regions", query);
  return (
    results.find(
      (region) => region.name.trim().toLowerCase() === normalizedRegionName.toLowerCase()
    ) ?? null
  );
}

async function fetchAllReleaseDatesForPlatformRegion(
  igdbPlatformIds: number[],
  regionId: number,
  limit?: number
): Promise<Map<number, number | null>> {
  const gameReleaseMap = new Map<number, number | null>();
  let offset = 0;
  const pageSize = 500;
  let hasMore = true;

  while (hasMore) {
    const query = `
      fields game, date;
      where platform = (${igdbPlatformIds.join(", ")}) & region = ${regionId};
      sort date asc;
      offset ${offset};
      limit ${pageSize};
    `;

    const releaseDates = await igdbRequest<IGDBReleaseDate[]>("release_dates", query);
    for (const releaseDate of releaseDates) {
      if (!gameReleaseMap.has(releaseDate.game)) {
        gameReleaseMap.set(releaseDate.game, releaseDate.date ?? null);
      }
    }

    process.stdout.write(`\r   Fetched ${gameReleaseMap.size} unique release entries...`);

    if (releaseDates.length < pageSize) {
      hasMore = false;
    } else if (limit && gameReleaseMap.size >= limit) {
      hasMore = false;
    } else {
      offset += pageSize;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  console.log("");

  if (limit && gameReleaseMap.size > limit) {
    return new Map(Array.from(gameReleaseMap.entries()).slice(0, limit));
  }

  return gameReleaseMap;
}

async function fetchMainGamesByIds(gameIds: number[]): Promise<IGDBGame[]> {
  if (gameIds.length === 0) {
    return [];
  }

  const allGames: IGDBGame[] = [];
  const chunkSize = 200;

  for (let i = 0; i < gameIds.length; i += chunkSize) {
    const chunk = gameIds.slice(i, i + chunkSize);
    const query = `
      fields id, name, slug, summary, cover.image_id, first_release_date, category;
      where id = (${chunk.join(", ")}) & category = ${IGDBGameCategory.MainGame} & version_parent = null;
      limit ${chunk.length};
    `;

    const games = await igdbRequest<IGDBGame[]>("games", query);
    allGames.push(...games);

    process.stdout.write(`\r   Loaded ${allGames.length}/${gameIds.length} game records...`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  console.log("");
  return allGames;
}

async function main() {
  const { platform: platformSlug, region: regionSlug, limit, dryRun } = parseArgs();

  console.log("=== Platform Region Import (IGDB) ===\n");
  console.log(`Platform: ${platformSlug}`);
  console.log(`Region: ${regionSlug}`);
  console.log(`Mode: ${dryRun ? "dry run" : "write"}`);
  if (limit) {
    console.log(`Limit: ${limit}`);
  }
  console.log("");

  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
    console.error("Error: TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET are required.");
    process.exit(1);
  }

  const platform = await prisma.platform.findUnique({
    where: { slug: platformSlug },
    select: { id: true, name: true, slug: true },
  });

  if (!platform) {
    console.error(`Platform "${platformSlug}" was not found in Trophy Rooms.`);
    process.exit(1);
  }

  const igdbPlatformIds = IGDB_PLATFORM_MAP[platform.slug];
  if (!igdbPlatformIds?.length) {
    console.error(`No IGDB platform mapping found for "${platform.slug}".`);
    process.exit(1);
  }

  const region = await fetchRegionBySlug(regionSlug);
  if (!region) {
    console.error(`IGDB region "${regionSlug}" was not found.`);
    process.exit(1);
  }

  console.log(`Resolved IGDB platform IDs: ${igdbPlatformIds.join(", ")}`);
  console.log(`Resolved IGDB region: ${region.name} (${region.id})`);
  console.log("");

  const releaseDates = await fetchAllReleaseDatesForPlatformRegion(
    igdbPlatformIds,
    region.id,
    limit
  );

  if (releaseDates.size === 0) {
    console.log("No release dates found for that platform/region.");
    return;
  }

  console.log(`Found ${releaseDates.size} unique release-date game IDs`);

  const igdbGames = await fetchMainGamesByIds(Array.from(releaseDates.keys()));
  console.log(`Filtered down to ${igdbGames.length} main games with no version parent`);

  const existingGames = await prisma.game.findMany({
    where: { platformId: platform.id },
    select: {
      gameFamily: {
        select: {
          title: true,
        },
      },
    },
  });

  const existingTitles = new Set(
    existingGames
      .map((game) => game.gameFamily?.title?.toLowerCase())
      .filter((title): title is string => Boolean(title))
  );

  const newGames = igdbGames.filter(
    (game) => !existingTitles.has(game.name.trim().toLowerCase())
  );

  console.log(`New ${platform.name} games to import: ${newGames.length}`);

  if (dryRun || newGames.length === 0) {
    if (dryRun && newGames.length > 0) {
      console.log("\nDry run sample:");
      for (const game of newGames.slice(0, 20)) {
        console.log(`  - ${game.name}`);
      }
    }
    return;
  }

  const standardVersion = await ensureStandardVersion();
  let createdFamilies = 0;
  let createdPlatformGames = 0;

  for (const game of newGames) {
    const trimmedTitle = game.name.trim();
    if (!trimmedTitle) {
      continue;
    }

    const releaseTimestamp = releaseDates.get(game.id) ?? game.first_release_date ?? null;
    const releaseDate = releaseTimestamp ? new Date(releaseTimestamp * 1000) : null;
    const slug = await ensureUniqueGameFamilySlug(
      generateSlug(game.slug?.trim() || trimmedTitle)
    );

    const gameFamily = await prisma.gameFamily.create({
      data: {
        title: trimmedTitle,
        slug,
        description: game.summary?.trim() || null,
        coverUrl: game.cover?.image_id
          ? getCoverUrl(game.cover.image_id, "cover_big")
          : null,
        releaseDate,
        type: GameType.BASE_GAME,
        screenshots: [],
      },
    });

    const createdGame = await prisma.game.create({
      data: {
        gameFamilyId: gameFamily.id,
        platformId: platform.id,
        releaseDate,
      },
    });

    await prisma.$executeRaw`
      INSERT INTO "_GameVersionGames" ("A", "B")
      VALUES (${createdGame.id}, ${standardVersion.id})
      ON CONFLICT DO NOTHING
    `;

    createdFamilies++;
    createdPlatformGames++;

    process.stdout.write(`\r   Imported ${createdFamilies}/${newGames.length}...`);
  }

  console.log("\n");
  console.log(`Imported ${createdFamilies} game families`);
  console.log(`Created ${createdPlatformGames} platform game entries for ${platform.name}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
