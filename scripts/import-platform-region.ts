import { Prisma, PrismaClient, GameType } from "@prisma/client";
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

const IGDB_RELEASE_REGION_IDS: Record<string, { id: number; name: string }> = {
  europe: { id: 1, name: "Europe" },
  "north-america": { id: 2, name: "North America" },
  australia: { id: 3, name: "Australia" },
  "new-zealand": { id: 4, name: "New Zealand" },
  japan: { id: 5, name: "Japan" },
  china: { id: 6, name: "China" },
  asia: { id: 7, name: "Asia" },
  worldwide: { id: 8, name: "Worldwide" },
  korea: { id: 9, name: "Korea" },
  brazil: { id: 10, name: "Brazil" },
};

interface IGDBReleaseDate {
  game: number;
  date?: number;
  release_region?: number;
}

const WESTERN_RELEASE_REGION_IDS = [1, 2, 3, 4, 8, 10];

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    platform: "gba",
    region: undefined as string | undefined,
    limit: undefined as number | undefined,
    dryRun: false,
    excludeJapaneseTitles: true,
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

    if (arg === "--include-japanese-titles") {
      options.excludeJapaneseTitles = false;
    }
  }

  if (options.region) {
    options.region = REGION_ALIASES[options.region] ?? options.region;
  }
  return options;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

function ensureUniqueGameFamilySlug(
  preferredSlug: string,
  existingSlugs: Set<string>
): string {
  let slug = preferredSlug;
  let counter = 1;

  while (existingSlugs.has(slug)) {
    slug = `${preferredSlug}-${counter}`;
    counter++;
  }

  existingSlugs.add(slug);
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
      where game.platforms = (${igdbPlatformIds.join(", ")}) & release_region = ${regionId};
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

async function fetchReleaseDatesByRegionsForGames(
  gameIds: number[],
  regionIds: number[]
): Promise<Map<number, number | null>> {
  if (gameIds.length === 0) {
    return new Map();
  }

  const releaseDatesByGame = new Map<number, number | null>();
  const chunkSize = 200;

  for (let index = 0; index < gameIds.length; index += chunkSize) {
    const chunk = gameIds.slice(index, index + chunkSize);
    const query = `
      fields game, date, release_region;
      where game = (${chunk.join(", ")}) & release_region = (${regionIds.join(", ")});
      sort date asc;
      limit 500;
    `;

    const releaseDates = await igdbRequest<IGDBReleaseDate[]>("release_dates", query);
    for (const releaseDate of releaseDates) {
      if (!releaseDatesByGame.has(releaseDate.game)) {
        releaseDatesByGame.set(releaseDate.game, releaseDate.date ?? null);
      }
    }

    process.stdout.write(
      `\r   Matched Western releases for ${releaseDatesByGame.size}/${gameIds.length} games...`
    );
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  console.log("");
  return releaseDatesByGame;
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

async function fetchAllMainGamesForPlatform(
  igdbPlatformIds: number[],
  limit?: number
): Promise<IGDBGame[]> {
  const allGames: IGDBGame[] = [];
  let offset = 0;
  const pageSize = 500;
  let hasMore = true;

  while (hasMore) {
    const query = `
      fields id, name, slug, summary, cover.image_id, first_release_date, category, game_type, keywords.name, websites.url;
      where platforms = (${igdbPlatformIds.join(", ")}) & game_type = 0 & version_parent = null;
      sort name asc;
      offset ${offset};
      limit ${pageSize};
    `;

    const games = await igdbRequest<IGDBGame[]>("games", query);
    const retailLikeGames = games.filter((game) => !looksNonRetailIGDBEntry(game));
    allGames.push(...retailLikeGames);

    process.stdout.write(`\r   Loaded ${allGames.length} main games...`);

    if (games.length < pageSize) {
      hasMore = false;
    } else if (limit && allGames.length >= limit) {
      hasMore = false;
    } else {
      offset += pageSize;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  console.log("");
  return limit ? allGames.slice(0, limit) : allGames;
}

function looksJapaneseTitle(title: string): boolean {
  return /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(title);
}

function looksNonRetailIGDBEntry(game: IGDBGame): boolean {
  const blockedKeywordFragments = [
    "homebrew",
    "rom hack",
    "fangame",
    "fan game",
    "unofficial",
    "clone",
  ];

  const blockedWebsiteFragments = [
    "itch.io",
    "romhacking.net",
  ];

  const hasBlockedKeyword = (game.keywords ?? []).some((keyword) => {
    const normalizedKeyword = keyword.name.trim().toLowerCase();
    return blockedKeywordFragments.some((fragment) => normalizedKeyword.includes(fragment));
  });

  if (hasBlockedKeyword) {
    return true;
  }

  return (game.websites ?? []).some((website) => {
    const normalizedUrl = website.url.trim().toLowerCase();
    return blockedWebsiteFragments.some((fragment) => normalizedUrl.includes(fragment));
  });
}

async function main() {
  const {
    platform: platformSlug,
    region: regionSlug,
    limit,
    dryRun,
    excludeJapaneseTitles,
  } = parseArgs();

  console.log("=== Platform Region Import (IGDB) ===\n");
  console.log(`Platform: ${platformSlug}`);
  console.log(`Region: ${regionSlug ?? "all"}`);
  console.log(`Mode: ${dryRun ? "dry run" : "write"}`);
  console.log(`Exclude Japanese titles: ${excludeJapaneseTitles ? "yes" : "no"}`);
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

  console.log(`Resolved IGDB platform IDs: ${igdbPlatformIds.join(", ")}`);
  console.log("");

  let releaseDates = new Map<number, number | null>();
  let igdbGames: IGDBGame[] = [];

  if (regionSlug) {
    const region = IGDB_RELEASE_REGION_IDS[regionSlug] ?? null;
    if (!region) {
      console.error(`IGDB region "${regionSlug}" was not found.`);
      process.exit(1);
    }

    console.log(`Resolved IGDB region: ${region.name} (${region.id})`);
    console.log("");

    releaseDates = await fetchAllReleaseDatesForPlatformRegion(
      igdbPlatformIds,
      region.id,
      limit
    );

    if (releaseDates.size === 0) {
      console.log("No release dates found for that platform/region.");
      return;
    }

    console.log(`Found ${releaseDates.size} unique release-date game IDs`);
    igdbGames = await fetchMainGamesByIds(Array.from(releaseDates.keys()));
    console.log(`Filtered down to ${igdbGames.length} main games with no version parent`);
  } else {
    igdbGames = await fetchAllMainGamesForPlatform(igdbPlatformIds, limit);
    console.log(`Found ${igdbGames.length} main games with no version parent`);

    releaseDates = await fetchReleaseDatesByRegionsForGames(
      igdbGames.map((game) => game.id),
      WESTERN_RELEASE_REGION_IDS
    );

    const westernReleaseFilteredGames = igdbGames.filter((game) => releaseDates.has(game.id));
    const excludedWithoutWesternRelease = igdbGames.length - westernReleaseFilteredGames.length;
    console.log(`Excluded ${excludedWithoutWesternRelease} titles without a Western release`);
    igdbGames = westernReleaseFilteredGames;
  }

  const filteredByLanguage = excludeJapaneseTitles
    ? igdbGames.filter((game) => !looksJapaneseTitle(game.name))
    : igdbGames;

  const excludedJapaneseCount = igdbGames.length - filteredByLanguage.length;
  if (excludeJapaneseTitles) {
    console.log(`Excluded ${excludedJapaneseCount} titles that look Japanese by name`);
  }

  const [existingGames, existingGameFamilies] = await Promise.all([
    prisma.game.findMany({
      where: { platformId: platform.id },
      select: {
        gameFamily: {
          select: {
            title: true,
          },
        },
      },
    }),
    prisma.gameFamily.findMany({
      where: { type: GameType.BASE_GAME },
      select: {
        id: true,
        title: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const existingPlatformTitles = new Set(
    existingGames
      .map((game) => game.gameFamily?.title ? normalizeTitle(game.gameFamily.title) : null)
      .filter((title): title is string => Boolean(title))
  );

  const existingFamilyByTitle = new Map<string, { id: string }>();
  for (const family of existingGameFamilies) {
    const normalizedTitle = normalizeTitle(family.title);
    if (!existingFamilyByTitle.has(normalizedTitle)) {
      existingFamilyByTitle.set(normalizedTitle, { id: family.id });
    }
  }

  const seenImportTitles = new Set(existingPlatformTitles);
  const newGames = filteredByLanguage.filter((game) => {
    const normalizedTitle = normalizeTitle(game.name);
    if (seenImportTitles.has(normalizedTitle)) {
      return false;
    }

    seenImportTitles.add(normalizedTitle);
    return true;
  });

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
  const existingSlugs = new Set(
    (
      await prisma.gameFamily.findMany({
        select: { slug: true },
      })
    ).map((gameFamily) => gameFamily.slug)
  );

  const chunkSize = 200;
  let createdFamilies = 0;
  let createdPlatformGames = 0;

  for (let index = 0; index < newGames.length; index += chunkSize) {
    const chunk = newGames.slice(index, index + chunkSize);
    const gameRowsToAttach: Array<{
      gameFamilyId: string;
      releaseDate: Date | null;
    }> = [];
    const familyRowsToCreate: Array<{
      sourceTitle: string;
      title: string;
      slug: string;
      description: string | null;
      coverUrl: string | null;
      releaseDate: Date | null;
      type: GameType;
      screenshots: string[];
    }> = [];

    for (const game of chunk) {
      const trimmedTitle = game.name.trim();
      if (!trimmedTitle) {
        continue;
      }

      const normalizedTitle = normalizeTitle(trimmedTitle);
      const releaseTimestamp = releaseDates.get(game.id) ?? game.first_release_date ?? null;
      const releaseDate = releaseTimestamp ? new Date(releaseTimestamp * 1000) : null;
      const existingFamily = existingFamilyByTitle.get(normalizedTitle);

      if (existingFamily) {
        gameRowsToAttach.push({
          gameFamilyId: existingFamily.id,
          releaseDate,
        });
        continue;
      }

      const preferredSlug = generateSlug(game.slug?.trim() || trimmedTitle) || `game-${game.id}`;
      const slug = ensureUniqueGameFamilySlug(preferredSlug, existingSlugs);

      familyRowsToCreate.push({
        sourceTitle: normalizedTitle,
        title: trimmedTitle,
        slug,
        description: game.summary?.trim() || null,
        coverUrl: game.cover?.image_id
          ? getCoverUrl(game.cover.image_id, "cover_big")
          : null,
        releaseDate,
        type: GameType.BASE_GAME,
        screenshots: [],
      });
    }

    if (familyRowsToCreate.length === 0 && gameRowsToAttach.length === 0) {
      continue;
    }

    const chunkResult = await prisma.$transaction(async (tx) => {
      const createdGameFamilies = familyRowsToCreate.length > 0
        ? await tx.gameFamily.createManyAndReturn({
            data: familyRowsToCreate.map(({ sourceTitle: _sourceTitle, ...row }) => row),
            select: {
              id: true,
              slug: true,
              releaseDate: true,
            },
          })
        : [];

      createdGameFamilies.forEach((gameFamily, createdIndex) => {
        const sourceTitle = familyRowsToCreate[createdIndex]?.sourceTitle;
        if (sourceTitle) {
          existingFamilyByTitle.set(sourceTitle, { id: gameFamily.id });
        }
      });

      const createdGames = await tx.game.createManyAndReturn({
        data: [
          ...gameRowsToAttach,
          ...createdGameFamilies.map((gameFamily) => ({
            gameFamilyId: gameFamily.id,
            platformId: platform.id,
            releaseDate: gameFamily.releaseDate,
          })),
        ].map((row) => ({
          gameFamilyId: row.gameFamilyId,
          platformId: platform.id,
          releaseDate: row.releaseDate,
        })),
        select: {
          id: true,
        },
      });

      if (createdGames.length > 0) {
        const versionLinks = Prisma.join(
          createdGames.map((game) => Prisma.sql`(${game.id}, ${standardVersion.id})`)
        );

        await tx.$executeRaw`
          INSERT INTO "_GameVersionGames" ("A", "B")
          VALUES ${versionLinks}
          ON CONFLICT DO NOTHING
        `;
      }

      return {
        createdFamilies: createdGameFamilies.length,
        createdPlatformGames: createdGames.length,
      };
    });

    createdFamilies += chunkResult.createdFamilies;
    createdPlatformGames += chunkResult.createdPlatformGames;

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
