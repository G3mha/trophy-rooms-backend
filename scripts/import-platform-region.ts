import { Prisma, PrismaClient, GameType } from "@prisma/client";
import { normalizeForSearch } from "../src/lib/normalize-search.js";
import {
  igdbRequest,
  getCoverUrl,
  IGDB_PLATFORM_MAP,
  isShippedRelease,
  meetsCatalogQualityBar,
  WESTERN_RELEASE_REGION_IDS,
  type IGDBGame,
  type IGDBReleaseDate,
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

interface IGDBGameReleaseDate extends IGDBReleaseDate {
  game: number;
}

// Earliest shipped release per IGDB game, on any platform and on the platform
// being imported. The Game gets its own platform's date. The family keeps the
// first release, which also decides whether a same-titled family is the same
// game, so a later port still joins its original's family. Cancelled, alpha,
// beta and next-gen patch releases don't count (isShippedRelease), and a game
// with no shipped release on the platform is left out of the import.
interface GameReleaseDates {
  first: number;
  onPlatform?: number;
}

type PlatformReleaseDates = Required<GameReleaseDates>;

function recordEarliestShippedReleases(
  datesByGame: Map<number, GameReleaseDates>,
  releaseDates: IGDBGameReleaseDate[],
  igdbPlatformIds: ReadonlySet<number>
) {
  for (const release of releaseDates.filter(isShippedRelease)) {
    const dates = datesByGame.get(release.game) ?? { first: release.date };
    dates.first = Math.min(dates.first, release.date);
    if (igdbPlatformIds.has(release.platform)) {
      dates.onPlatform = Math.min(dates.onPlatform ?? release.date, release.date);
    }
    datesByGame.set(release.game, dates);
  }
}

function releasedOnPlatform(
  datesByGame: Map<number, GameReleaseDates>
): Map<number, PlatformReleaseDates> {
  const released = new Map<number, PlatformReleaseDates>();
  for (const [gameId, { first, onPlatform }] of datesByGame) {
    if (onPlatform !== undefined) released.set(gameId, { first, onPlatform });
  }
  return released;
}

const RERELEASE_PLATFORM_SLUGS = new Set([
  "3ds",
  "wii",
  "wii-u",
  "switch",
  "switch-2",
  "ps3",
  "ps4",
  "ps5",
  "psp",
  "vita",
  "xbox-360",
  "xbox-one",
  "xbox-series",
  "steam",
  "windows",
  "pc",
  "macos",
  "ios",
  "android",
]);

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

function shouldReuseExistingFamily(
  family: { id: string; releaseDate: Date | null },
  platformSlug: string,
  releaseDate: Date | null
): boolean {
  if (RERELEASE_PLATFORM_SLUGS.has(platformSlug)) {
    return true;
  }

  if (!family.releaseDate || !releaseDate) {
    return false;
  }

  const yearGap = Math.abs(
    family.releaseDate.getUTCFullYear() - releaseDate.getUTCFullYear()
  );
  return yearGap <= 5;
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
): Promise<Map<number, PlatformReleaseDates>> {
  const datesByGame = new Map<number, GameReleaseDates>();
  const platformIds = new Set(igdbPlatformIds);
  let offset = 0;
  const pageSize = 500;
  let hasMore = true;

  while (hasMore) {
    const query = `
      fields game, date, platform, status.name;
      where game.platforms = (${igdbPlatformIds.join(", ")}) & release_region = ${regionId};
      sort date asc;
      offset ${offset};
      limit ${pageSize};
    `;

    const releaseDates = await igdbRequest<IGDBGameReleaseDate[]>("release_dates", query);
    recordEarliestShippedReleases(datesByGame, releaseDates, platformIds);
    const releasedCount = releasedOnPlatform(datesByGame).size;

    process.stdout.write(`\r   Fetched releases for ${releasedCount} games on the platform...`);

    if (releaseDates.length < pageSize) {
      hasMore = false;
    } else if (limit && releasedCount >= limit) {
      hasMore = false;
    } else {
      offset += pageSize;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  console.log("");

  const released = releasedOnPlatform(datesByGame);
  if (limit && released.size > limit) {
    return new Map(Array.from(released.entries()).slice(0, limit));
  }

  return released;
}

async function fetchReleaseDatesByRegionsForGames(
  gameIds: number[],
  regionIds: number[],
  igdbPlatformIds: number[]
): Promise<Map<number, PlatformReleaseDates>> {
  if (gameIds.length === 0) {
    return new Map();
  }

  const datesByGame = new Map<number, GameReleaseDates>();
  const platformIds = new Set(igdbPlatformIds);
  const chunkSize = 200;

  const pageSize = 500;

  for (let index = 0; index < gameIds.length; index += chunkSize) {
    const chunk = gameIds.slice(index, index + chunkSize);

    // 200 games can have well over 500 regional release entries (the first
    // 200 PS4 games have about 1,000), so page until IGDB runs out
    for (let offset = 0; ; offset += pageSize) {
      const query = `
        fields game, date, release_region, platform, status.name;
        where game = (${chunk.join(", ")}) & release_region = (${regionIds.join(", ")});
        sort date asc;
        offset ${offset};
        limit ${pageSize};
      `;

      const releaseDates = await igdbRequest<IGDBGameReleaseDate[]>("release_dates", query);
      recordEarliestShippedReleases(datesByGame, releaseDates, platformIds);

      await new Promise((resolve) => setTimeout(resolve, 250));
      if (releaseDates.length < pageSize) break;
    }

    process.stdout.write(
      `\r   Matched Western releases on the platform for ${releasedOnPlatform(datesByGame).size}/${gameIds.length} games...`
    );
  }

  console.log("");
  return releasedOnPlatform(datesByGame);
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
      fields id, name, slug, summary, cover.image_id, first_release_date, game_type, rating_count;
      where id = (${chunk.join(", ")}) & game_type = 0 & version_parent = null;
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
      fields id, name, slug, summary, cover.image_id, first_release_date, category, game_type, rating_count, keywords.name, websites.url;
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

  let releaseDates = new Map<number, PlatformReleaseDates>();
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

    console.log(`Found ${releaseDates.size} games with a shipped ${region.name} release on ${platform.name}`);
    igdbGames = await fetchMainGamesByIds(Array.from(releaseDates.keys()));
    console.log(`Filtered down to ${igdbGames.length} main games with no version parent`);
  } else {
    igdbGames = await fetchAllMainGamesForPlatform(igdbPlatformIds, limit);
    console.log(`Found ${igdbGames.length} main games with no version parent`);

    releaseDates = await fetchReleaseDatesByRegionsForGames(
      igdbGames.map((game) => game.id),
      WESTERN_RELEASE_REGION_IDS,
      igdbPlatformIds
    );

    const westernReleaseFilteredGames = igdbGames.filter((game) => releaseDates.has(game.id));
    const excludedWithoutWesternRelease = igdbGames.length - westernReleaseFilteredGames.length;
    console.log(
      `Excluded ${excludedWithoutWesternRelease} titles without a shipped Western release on ${platform.name}`
    );
    igdbGames = westernReleaseFilteredGames;
  }

  // Same bar cleanup-shovelware.ts removes games by, so imports don't need cleaning up
  const meetingQualityBar = igdbGames.filter((game) => meetsCatalogQualityBar(game, platform.slug).ok);
  console.log(`Excluded ${igdbGames.length - meetingQualityBar.length} titles below the catalog quality bar`);
  igdbGames = meetingQualityBar;

  const filteredByLanguage = excludeJapaneseTitles
    ? igdbGames.filter((game) => !looksJapaneseTitle(game.name))
    : igdbGames;

  const excludedJapaneseCount = igdbGames.length - filteredByLanguage.length;
  if (excludeJapaneseTitles) {
    console.log(`Excluded ${excludedJapaneseCount} titles that look Japanese by name`);
  }

  const [existingGames, existingGameFamilies, identifiedGames] = await Promise.all([
    prisma.game.findMany({
      where: { platformId: platform.id },
      select: {
        igdbId: true,
        gameFamilyId: true,
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
        releaseDate: true,
        igdbId: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.game.findMany({
      where: { igdbId: { not: null } },
      select: { igdbId: true, gameFamilyId: true },
    }),
  ]);

  // Games already on the platform: by IGDB id, and by title for editions whose
  // IGDB game isn't known yet (they may be any game with that name)
  const igdbIdsOnPlatform = new Set(
    existingGames.map((game) => game.igdbId).filter((id): id is number => id !== null)
  );
  const unidentifiedPlatformTitles = new Set(
    existingGames
      .filter((game) => game.igdbId === null && game.gameFamily)
      .map((game) => normalizeTitle(game.gameFamily!.title))
  );
  const familiesOnPlatform = new Set(
    existingGames.map((game) => game.gameFamilyId).filter((id): id is string => id !== null)
  );

  // Families by IGDB game: an edition's id finds a remake or port kept in its
  // original's family, and the family's own id wins over it
  const familyIdByIgdbId = new Map<number, string>();
  for (const game of identifiedGames) {
    if (game.igdbId !== null && game.gameFamilyId && !familyIdByIgdbId.has(game.igdbId)) {
      familyIdByIgdbId.set(game.igdbId, game.gameFamilyId);
    }
  }
  for (const family of existingGameFamilies) {
    if (family.igdbId !== null) familyIdByIgdbId.set(family.igdbId, family.id);
  }

  // Title matches only reach families whose IGDB game isn't known: one that has
  // an id is a specific game, and a same-named game isn't it (Need for Speed:
  // Most Wanted 2012 is not the 2005 game)
  const existingFamilyByTitle = new Map<
    string,
    Array<{ id: string; releaseDate: Date | null }>
  >();
  for (const family of existingGameFamilies) {
    if (family.igdbId !== null) continue;
    const normalizedTitle = normalizeTitle(family.title);
    const families = existingFamilyByTitle.get(normalizedTitle) ?? [];
    families.push({ id: family.id, releaseDate: family.releaseDate });
    existingFamilyByTitle.set(normalizedTitle, families);
  }

  const seenIgdbIds = new Set(igdbIdsOnPlatform);
  const newGames = filteredByLanguage.filter((game) => {
    if (seenIgdbIds.has(game.id) || unidentifiedPlatformTitles.has(normalizeTitle(game.name))) {
      return false;
    }

    seenIgdbIds.add(game.id);
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
      igdbId: number;
    }> = [];
    const familyRowsToCreate: Array<{
      // The new family's game takes its own platform's date, not the family's
      gameReleaseDate: Date;
      title: string;
      slug: string;
      searchTitle: string;
      description: string | null;
      coverUrl: string | null;
      releaseDate: Date | null;
      igdbId: number;
      type: GameType;
      screenshots: string[];
    }> = [];

    for (const game of chunk) {
      const trimmedTitle = game.name.trim();
      if (!trimmedTitle) {
        continue;
      }

      // Every game here was selected for having a shipped release on the platform
      const dates = releaseDates.get(game.id);
      if (!dates) {
        continue;
      }

      const normalizedTitle = normalizeTitle(trimmedTitle);
      const firstRelease = new Date(dates.first * 1000);
      const platformRelease = new Date(dates.onPlatform * 1000);
      const knownFamilyId = familyIdByIgdbId.get(game.id);
      const existingFamilyId =
        knownFamilyId ??
        (existingFamilyByTitle.get(normalizedTitle) ?? []).find(
          (family) => !familiesOnPlatform.has(family.id) && shouldReuseExistingFamily(family, platform.slug, firstRelease)
        )?.id;

      if (existingFamilyId) {
        // A family has one edition per platform
        if (familiesOnPlatform.has(existingFamilyId)) continue;
        familiesOnPlatform.add(existingFamilyId);
        gameRowsToAttach.push({
          gameFamilyId: existingFamilyId,
          releaseDate: platformRelease,
          igdbId: game.id,
        });
        continue;
      }

      const preferredSlug = generateSlug(game.slug?.trim() || trimmedTitle) || `game-${game.id}`;
      const slug = ensureUniqueGameFamilySlug(preferredSlug, existingSlugs);

      familyRowsToCreate.push({
        gameReleaseDate: platformRelease,
        title: trimmedTitle,
        slug,
        searchTitle: normalizeForSearch(trimmedTitle),
        description: game.summary?.trim() || null,
        coverUrl: game.cover?.image_id
          ? getCoverUrl(game.cover.image_id, "cover_big")
          : null,
        releaseDate: firstRelease,
        igdbId: game.id,
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
            data: familyRowsToCreate.map(
              ({ gameReleaseDate: _gameReleaseDate, ...row }) => row
            ),
            select: {
              id: true,
              slug: true,
              releaseDate: true,
              igdbId: true,
            },
          })
        : [];

      // Later chunks find these by IGDB id, not by title
      for (const gameFamily of createdGameFamilies) {
        if (gameFamily.igdbId !== null) familyIdByIgdbId.set(gameFamily.igdbId, gameFamily.id);
        familiesOnPlatform.add(gameFamily.id);
      }

      const gameReleaseDateBySlug = new Map(
        familyRowsToCreate.map((row) => [row.slug, row.gameReleaseDate])
      );
      const createdGames = await tx.game.createManyAndReturn({
        data: [
          ...gameRowsToAttach,
          ...createdGameFamilies.map((gameFamily) => ({
            gameFamilyId: gameFamily.id,
            platformId: platform.id,
            releaseDate: gameReleaseDateBySlug.get(gameFamily.slug) ?? null,
            igdbId: gameFamily.igdbId,
          })),
        ].map((row) => ({
          gameFamilyId: row.gameFamilyId,
          platformId: platform.id,
          releaseDate: row.releaseDate,
          igdbId: row.igdbId,
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
