interface IGDBToken {
  access_token: string;
  expires_in: number;
  token_type: string;
}

try {
  process.loadEnvFile?.();
} catch {
  // Production environments inject secrets directly; local scripts can rely on .env.
}

export interface IGDBGame {
  id: number;
  name: string;
  slug?: string;
  summary?: string;
  cover?: {
    id: number;
    image_id: string;
  };
  first_release_date?: number;
  genres?: { id: number; name: string }[];
  rating?: number;
  rating_count?: number;
  total_rating?: number;
  total_rating_count?: number;
  category?: number; // 0 = main game, 1 = DLC, etc.
  game_type?: number;
  keywords?: { id: number; name: string }[];
  websites?: { id: number; url: string }[];
  platforms?: { id: number; name: string }[];
}

// IGDB Platform IDs mapped to our slugs
export const IGDB_PLATFORM_MAP: Record<string, number[]> = {
  // Nintendo Consoles
  "nes": [18],
  "snes": [19],
  "n64": [4],
  "gamecube": [21],
  "wii": [5],
  "wii-u": [41],
  "switch": [130],
  "switch-2": [508],

  // Nintendo Handhelds
  "game-boy": [33],
  "game-boy-color": [22],
  "gba": [24],
  "nds": [20],
  "3ds": [37],

  // PlayStation
  "ps1": [7],
  "ps2": [8],
  "ps3": [9],
  "ps4": [48],
  "ps5": [167],
  "psp": [38],
  "vita": [46],

  // Xbox
  "xbox": [11],
  "xbox-360": [12],
  "xbox-one": [49],
  "xbox-series": [169],

  // Sega
  "master-system": [64],
  "genesis": [29], // Mega Drive
  "saturn": [32],
  "dreamcast": [23],
  "game-gear": [35],

  // PC - all map to PC platform in IGDB
  "pc": [6],
  "macos": [14],
  "linux": [3],
  "steam": [6],     // Steam games are PC games
  "epic": [6],      // Epic games are PC games
  "gog": [6],       // GOG games are PC games

  // Mobile & Other
  "ios": [39],
  "android": [34],
  "atari-2600": [59],
  "atari-7800": [60],
  "neo-geo": [80],
  "turbografx-16": [86],
};

export const PRIMARY_PLATFORM_SLUG_BY_IGDB_ID: Record<number, string> = {
  18: "nes",
  19: "snes",
  4: "n64",
  21: "gamecube",
  5: "wii",
  41: "wii-u",
  130: "switch",
  508: "switch-2",
  33: "game-boy",
  22: "game-boy-color",
  24: "gba",
  20: "nds",
  37: "3ds",
  7: "ps1",
  8: "ps2",
  9: "ps3",
  48: "ps4",
  167: "ps5",
  38: "psp",
  46: "vita",
  11: "xbox",
  12: "xbox-360",
  49: "xbox-one",
  169: "xbox-series",
  64: "master-system",
  29: "genesis",
  32: "saturn",
  23: "dreamcast",
  35: "game-gear",
  6: "pc",
  14: "macos",
  3: "linux",
  39: "ios",
  34: "android",
  59: "atari-2600",
  60: "atari-7800",
  80: "neo-geo",
  86: "turbografx-16",
};

// Game category enum from IGDB
export enum IGDBGameCategory {
  MainGame = 0,
  DLCAddon = 1,
  Expansion = 2,
  Bundle = 3,
  StandaloneExpansion = 4,
  Mod = 5,
  Episode = 6,
  Season = 7,
  Remake = 8,
  Remaster = 9,
  ExpandedGame = 10,
  Port = 11,
  Fork = 12,
  Pack = 13,
  Update = 14,
}

export interface QualityFilter {
  minRating?: number;          // Minimum rating (0-100)
  minRatingCount?: number;     // Minimum number of ratings
  categoryInclude?: number[];  // Game categories to include
}

// Quality filter presets
export const QUALITY_FILTERS = {
  // Strict: Only well-rated games with sufficient reviews
  strict: {
    minRating: 65,
    minRatingCount: 5,
    categoryInclude: [
      IGDBGameCategory.MainGame,
      IGDBGameCategory.Remake,
      IGDBGameCategory.Remaster,
      IGDBGameCategory.StandaloneExpansion,
    ],
  } as QualityFilter,
  // Moderate: Good games with some reviews
  moderate: {
    minRating: 50,
    minRatingCount: 3,
    categoryInclude: [
      IGDBGameCategory.MainGame,
      IGDBGameCategory.Remake,
      IGDBGameCategory.Remaster,
      IGDBGameCategory.StandaloneExpansion,
      IGDBGameCategory.ExpandedGame,
    ],
  } as QualityFilter,
  // Permissive: Any main game with at least one rating
  permissive: {
    minRatingCount: 1,
    categoryInclude: [
      IGDBGameCategory.MainGame,
      IGDBGameCategory.Remake,
      IGDBGameCategory.Remaster,
      IGDBGameCategory.StandaloneExpansion,
      IGDBGameCategory.ExpandedGame,
      IGDBGameCategory.Port,
    ],
  } as QualityFilter,
  // No filter: Just main games, no rating requirement
  noFilter: {
    categoryInclude: [
      IGDBGameCategory.MainGame,
      IGDBGameCategory.Remake,
      IGDBGameCategory.Remaster,
    ],
  } as QualityFilter,
};

function getTwitchClientId(): string {
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) {
    throw new Error("TWITCH_CLIENT_ID is required");
  }
  return clientId;
}

function getTwitchClientSecret(): string {
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error("TWITCH_CLIENT_SECRET is required");
  }
  return clientSecret;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getIGDBToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = getTwitchClientId();
  const clientSecret = getTwitchClientSecret();

  const response = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: "POST" }
  );

  if (!response.ok) {
    throw new Error(`Failed to get IGDB token: ${response.statusText}`);
  }

  const data: IGDBToken = await response.json();

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return cachedToken.token;
}

export async function igdbRequest<T>(
  endpoint: string,
  query: string
): Promise<T> {
  const token = await getIGDBToken();
  const clientId = getTwitchClientId();

  const response = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body: query,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`IGDB API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Fetch games for specific platform IDs with quality filtering
 */
export async function fetchGamesForPlatform(
  igdbPlatformIds: number[],
  _filter: QualityFilter,
  offset: number = 0,
  limit: number = 500
): Promise<IGDBGame[]> {
  const platformFilter = igdbPlatformIds.join(", ");

  // Build where conditions
  const conditions: string[] = [
    `platforms = (${platformFilter})`,
  ];

  // NOTE: Category filter disabled - most IGDB games don't have category set
  // The field is null for most games, so category = 0 returns empty results
  // if (filter.categoryInclude && filter.categoryInclude.length > 0) {
  //   conditions.push(`category = (${filter.categoryInclude.join(", ")})`);
  // }

  // NOTE: Rating filters also disabled - most games don't have ratings
  // This causes 0 results for most platforms
  // if (filter.minRating !== undefined) {
  //   conditions.push(`rating >= ${filter.minRating}`);
  // }
  // if (filter.minRatingCount !== undefined) {
  //   conditions.push(`rating_count >= ${filter.minRatingCount}`);
  // }

  const query = `
    fields id, name, slug, summary, cover.image_id, first_release_date, genres.name,
           rating, rating_count, total_rating, total_rating_count, category, platforms.id, platforms.name;
    where ${conditions.join(" & ")};
    sort total_rating desc;
    offset ${offset};
    limit ${limit};
  `;

  return igdbRequest<IGDBGame[]>("games", query);
}

/**
 * Fetch all games for a platform with quality filtering
 */
export async function fetchAllGamesForPlatform(
  igdbPlatformIds: number[],
  filter: QualityFilter,
  onProgress?: (fetched: number) => void
): Promise<IGDBGame[]> {
  const allGames: IGDBGame[] = [];
  let offset = 0;
  const limit = 500;
  let hasMore = true;

  while (hasMore) {
    const games = await fetchGamesForPlatform(igdbPlatformIds, filter, offset, limit);
    allGames.push(...games);

    if (onProgress) {
      onProgress(allGames.length);
    }

    if (games.length < limit) {
      hasMore = false;
    } else {
      offset += limit;
      // Rate limiting: wait 250ms between requests (4 req/sec limit)
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  return allGames;
}

/**
 * Count games for a platform with quality filtering
 */
export async function countGamesForPlatform(
  igdbPlatformIds: number[],
  _filter: QualityFilter
): Promise<number> {
  const platformFilter = igdbPlatformIds.join(", ");

  const conditions: string[] = [
    `platforms = (${platformFilter})`,
  ];

  // NOTE: Filters disabled - see fetchGamesForPlatform for explanation

  const query = `
    fields id;
    where ${conditions.join(" & ")};
    limit 500;
  `;

  // IGDB doesn't have a true count endpoint, so we estimate
  const games = await igdbRequest<{ id: number }[]>("games/count", query);
  return (games as unknown as { count: number }).count || 0;
}

// Legacy functions for backwards compatibility
export async function fetchNintendoSwitchGames(
  offset: number = 0,
  limit: number = 500
): Promise<IGDBGame[]> {
  return fetchGamesForPlatform([130, 508], {}, offset, limit);
}

export async function fetchAllNintendoSwitchGames(): Promise<IGDBGame[]> {
  return fetchAllGamesForPlatform([130, 508], {});
}

export async function countNintendoSwitchGames(): Promise<number> {
  return countGamesForPlatform([130, 508], {});
}

export function getCoverUrl(
  imageId: string,
  size: "cover_big" | "cover_small" | "720p" | "1080p" = "cover_big"
): string {
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}

/**
 * Search for a game by title on IGDB
 * Returns the best match or null if not found
 */
export async function searchGameByTitle(
  title: string,
  platformIds?: number[]
): Promise<IGDBGame | null> {
  // Escape special characters in title for IGDB search
  const escapedTitle = title.replace(/"/g, '\\"');

  let whereClause = `name ~ "${escapedTitle}"`;
  if (platformIds && platformIds.length > 0) {
    whereClause += ` & platforms = (${platformIds.join(", ")})`;
  }

  const query = `
    fields id, name, slug, summary, cover.image_id, first_release_date, rating, rating_count,
           total_rating, total_rating_count, category, platforms.id, platforms.name;
    search "${escapedTitle}";
    where ${whereClause};
    limit 1;
  `;

  try {
    const results = await igdbRequest<IGDBGame[]>("games", query);
    return results[0] ?? null;
  } catch {
    return null;
  }
}

export function extractIGDBGameSlug(urlString: string): string | null {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();
    if (!hostname.endsWith("igdb.com")) {
      return null;
    }

    const segments = url.pathname
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean);

    const gamesIndex = segments.findIndex((segment) => segment === "games");
    if (gamesIndex === -1 || gamesIndex + 1 >= segments.length) {
      return null;
    }

    const slugSegmentIndex = gamesIndex + 1;
    if (slugSegmentIndex >= segments.length) {
      return null;
    }

    const slugSegment = segments[slugSegmentIndex];
    if (slugSegment === undefined) {
      return null;
    }

    return decodeURIComponent(slugSegment).toLowerCase();
  } catch {
    return null;
  }
}

export async function fetchGameBySlug(slug: string): Promise<IGDBGame | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) {
    return null;
  }

  const escapedSlug = normalizedSlug.replace(/"/g, '\\"');
  const query = `
    fields id, name, slug, summary, cover.image_id, first_release_date, category, platforms.id, platforms.name;
    where slug = "${escapedSlug}";
    limit 1;
  `;

  try {
    const results = await igdbRequest<IGDBGame[]>("games", query);
    return results[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Batch search for multiple games by title
 * More efficient than individual searches
 */
export async function searchGamesByTitles(
  titles: string[]
): Promise<Map<string, IGDBGame | null>> {
  const results = new Map<string, IGDBGame | null>();

  // IGDB doesn't support true batch search, so we search one at a time
  // with rate limiting
  for (const title of titles) {
    const game = await searchGameByTitle(title);
    results.set(title.toLowerCase(), game);
    // Rate limit: 250ms between requests
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return results;
}
