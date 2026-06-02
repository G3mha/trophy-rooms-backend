import { PrismaClient } from "@prisma/client";
import {
  CachePrefix,
  CacheTTL,
  cacheKey,
  getCachedOrCompute,
} from "./cache.js";
import { normalizeForSearch } from "./normalize-search.js";

function extractPrismaRawError(error: unknown): { message: string; postgresCode: string | null } {
  if (!error || typeof error !== "object") {
    return { message: String(error), postgresCode: null };
  }

  const record = error as {
    message?: unknown;
    code?: unknown;
    meta?: { code?: unknown; message?: unknown } | null;
  };

  const message =
    typeof record.message === "string"
      ? record.message
      : typeof record.meta?.message === "string"
        ? record.meta.message
        : String(error);

  const postgresCode =
    typeof record.meta?.code === "string"
      ? record.meta.code
      : typeof record.code === "string" && /^\d{5}$/.test(record.code)
        ? record.code
        : null;

  return { message, postgresCode };
}

function isMissingTrigramExtensionError(error: unknown): boolean {
  const { message, postgresCode } = extractPrismaRawError(error);
  return (
    (postgresCode === "42883" && message.includes("similarity")) ||
    message.includes("similarity(") ||
    message.includes("function similarity")
  );
}

function isMissingSearchVectorError(error: unknown): boolean {
  const { message, postgresCode } = extractPrismaRawError(error);
  return (
    (postgresCode === "42703" && message.includes("search_vector")) ||
    message.includes('column "search_vector" does not exist')
  );
}

function isSearchFeatureUnavailableError(error: unknown): boolean {
  return isMissingTrigramExtensionError(error) || isMissingSearchVectorError(error);
}

function likePattern(search: string): string {
  return `%${search.toLowerCase()}%`;
}

/**
 * Convert a search string to a PostgreSQL tsquery format.
 * Handles multiple words by joining with & (AND) and adds prefix matching with :*.
 */
export function toTsQuery(search: string): string {
  // Sanitize and split into words
  const words = search
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, " ") // Remove special characters
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words.length === 0) return "";

  // Join with & for AND matching, add :* for prefix matching
  return words.map((word) => `${word}:*`).join(" & ");
}

/**
 * Search games using case-insensitive title matching via GameFamily (uncached).
 * Returns game IDs ordered by relevance.
 *
 * Since Game doesn't have a title column directly (it's on GameFamily),
 * we join with GameFamily to search by title.
 * Also searches the normalized searchTitle for fuzzy matching (handles "Leaf Green" → "LeafGreen").
 */
async function searchGamesFullTextUncached(
  prisma: PrismaClient,
  search: string,
  limit: number
): Promise<string[]> {
  const normalizedSearch = normalizeForSearch(search);

  // Use trigram similarity on GameFamily.title and also match against normalized searchTitle
  const results = await prisma.$queryRaw<{ id: string }[]>`
    SELECT g.id
    FROM "Game" g
    JOIN "GameFamily" gf ON g."gameFamilyId" = gf.id
    WHERE similarity(gf.title, ${search}) > 0.1
       OR LOWER(gf.title) LIKE ${"%" + search.toLowerCase() + "%"}
       OR gf."searchTitle" LIKE ${"%" + normalizedSearch + "%"}
    ORDER BY
      CASE WHEN gf."searchTitle" LIKE ${"%" + normalizedSearch + "%"} THEN 0 ELSE 1 END,
      similarity(gf.title, ${search}) DESC,
      gf.title ASC
    LIMIT ${limit}
  `;

  return results.map((r) => r.id);
}

async function searchGamesLikeUncached(
  prisma: PrismaClient,
  search: string,
  limit: number
): Promise<string[]> {
  const normalizedSearch = normalizeForSearch(search);

  const results = await prisma.$queryRaw<{ id: string }[]>`
    SELECT g.id
    FROM "Game" g
    JOIN "GameFamily" gf ON g."gameFamilyId" = gf.id
    WHERE LOWER(gf.title) LIKE ${likePattern(search)}
       OR gf."searchTitle" LIKE ${"%" + normalizedSearch + "%"}
    ORDER BY
      CASE WHEN gf."searchTitle" LIKE ${"%" + normalizedSearch + "%"} THEN 0 ELSE 1 END,
      gf.title ASC
    LIMIT ${limit}
  `;

  return results.map((r) => r.id);
}

/**
 * Search games with trigram similarity for fuzzy matching (uncached).
 * Searches via GameFamily since Game doesn't have a title column directly.
 */
async function searchGamesFuzzyUncached(
  prisma: PrismaClient,
  search: string,
  limit: number
): Promise<string[]> {
  const results = await prisma.$queryRaw<{ id: string }[]>`
    SELECT g.id
    FROM "Game" g
    JOIN "GameFamily" gf ON g."gameFamilyId" = gf.id
    WHERE similarity(gf.title, ${search}) > 0.1
    ORDER BY similarity(gf.title, ${search}) DESC
    LIMIT ${limit}
  `;

  return results.map((r) => r.id);
}

/**
 * Combined search: tries full-text first, falls back to fuzzy if no results.
 * Results are cached for performance.
 */
export async function searchGames(
  prisma: PrismaClient,
  search: string,
  limit: number = 1000
): Promise<string[]> {
  const key = cacheKey(CachePrefix.GAME_SEARCH, { search: search.toLowerCase(), limit });

  return getCachedOrCompute(key, CacheTTL.SEARCH_RESULTS, async () => {
    let fullTextResults: string[] = [];
    try {
      fullTextResults = await searchGamesFullTextUncached(prisma, search, limit);
    } catch (error) {
      if (!isMissingTrigramExtensionError(error)) {
        throw error;
      }

      return searchGamesLikeUncached(prisma, search, limit);
    }

    if (fullTextResults.length > 0) {
      return fullTextResults;
    }

    try {
      return await searchGamesFuzzyUncached(prisma, search, limit);
    } catch (error) {
      if (!isMissingTrigramExtensionError(error)) {
        throw error;
      }

      return searchGamesLikeUncached(prisma, search, limit);
    }
  });
}

/**
 * Search achievements using PostgreSQL full-text search.
 * Results are cached for performance.
 */
export async function searchAchievementsFullText(
  prisma: PrismaClient,
  search: string,
  limit: number = 1000
): Promise<string[]> {
  const key = cacheKey(CachePrefix.ACHIEVEMENT_SEARCH, { search: search.toLowerCase(), limit });

  return getCachedOrCompute(key, CacheTTL.SEARCH_RESULTS, async () => {
    const tsquery = toTsQuery(search);
    if (!tsquery) return [];

    try {
      const results = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM "Achievement"
        WHERE search_vector @@ to_tsquery('english', ${tsquery})
        ORDER BY ts_rank(search_vector, to_tsquery('english', ${tsquery})) DESC
        LIMIT ${limit}
      `;

      return results.map((r) => r.id);
    } catch (error) {
      if (!isMissingSearchVectorError(error)) {
        throw error;
      }

      const fallbackResults = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM "Achievement"
        WHERE LOWER(title) LIKE ${likePattern(search)}
           OR LOWER(COALESCE(description, '')) LIKE ${likePattern(search)}
        ORDER BY title ASC
        LIMIT ${limit}
      `;

      return fallbackResults.map((r) => r.id);
    }
  });
}

/**
 * Search game versions using PostgreSQL full-text search.
 * Results are cached for performance.
 */
export async function searchGameVersionsFullText(
  prisma: PrismaClient,
  search: string,
  limit: number = 1000
): Promise<string[]> {
  const key = cacheKey(CachePrefix.GAME_VERSION_SEARCH, { search: search.toLowerCase(), limit });

  return getCachedOrCompute(key, CacheTTL.SEARCH_RESULTS, async () => {
    const tsquery = toTsQuery(search);
    if (!tsquery) return [];

    try {
      const results = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM "GameVersion"
        WHERE search_vector @@ to_tsquery('english', ${tsquery})
        ORDER BY ts_rank(search_vector, to_tsquery('english', ${tsquery})) DESC
        LIMIT ${limit}
      `;

      return results.map((r) => r.id);
    } catch (error) {
      if (!isMissingSearchVectorError(error)) {
        throw error;
      }

      const fallbackResults = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM "GameVersion"
        WHERE LOWER(name) LIKE ${likePattern(search)}
           OR LOWER(COALESCE(description, '')) LIKE ${likePattern(search)}
        ORDER BY name ASC
        LIMIT ${limit}
      `;

      return fallbackResults.map((r) => r.id);
    }
  });
}

/**
 * Search DLCs using PostgreSQL full-text search.
 * Results are cached for performance.
 */
export async function searchDLCsFullText(
  prisma: PrismaClient,
  search: string,
  limit: number = 1000
): Promise<string[]> {
  const key = cacheKey(CachePrefix.DLC_SEARCH, { search: search.toLowerCase(), limit });

  return getCachedOrCompute(key, CacheTTL.SEARCH_RESULTS, async () => {
    const tsquery = toTsQuery(search);
    if (!tsquery) return [];

    try {
      const results = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM "DLC"
        WHERE search_vector @@ to_tsquery('english', ${tsquery})
        ORDER BY ts_rank(search_vector, to_tsquery('english', ${tsquery})) DESC
        LIMIT ${limit}
      `;

      return results.map((r) => r.id);
    } catch (error) {
      if (!isMissingSearchVectorError(error)) {
        throw error;
      }

      const fallbackResults = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM "DLC"
        WHERE LOWER(name) LIKE ${likePattern(search)}
           OR LOWER(COALESCE(description, '')) LIKE ${likePattern(search)}
        ORDER BY name ASC
        LIMIT ${limit}
      `;

      return fallbackResults.map((r) => r.id);
    }
  });
}

/**
 * Search game families using case-insensitive title matching with trigram similarity.
 * Uses fuzzy matching for typo tolerance.
 * Also searches normalized searchTitle for flexible matching (e.g., "Leaf Green" → "LeafGreen").
 * Results are cached for performance.
 */
export async function searchGameFamilies(
  prisma: PrismaClient,
  search: string,
  limit: number = 1000
): Promise<string[]> {
  const key = cacheKey(CachePrefix.GAME_FAMILY_SEARCH, { search: search.toLowerCase(), limit });

  return getCachedOrCompute(key, CacheTTL.SEARCH_RESULTS, async () => {
    const normalizedSearch = normalizeForSearch(search);

    try {
      // Use trigram similarity for fuzzy matching on title and also match against normalized searchTitle
      const results = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM "GameFamily"
        WHERE similarity(title, ${search}) > 0.1
           OR LOWER(title) LIKE ${likePattern(search)}
           OR "searchTitle" LIKE ${"%" + normalizedSearch + "%"}
        ORDER BY
          CASE WHEN "searchTitle" LIKE ${"%" + normalizedSearch + "%"} THEN 0 ELSE 1 END,
          similarity(title, ${search}) DESC,
          title ASC
        LIMIT ${limit}
      `;

      return results.map((r) => r.id);
    } catch (error) {
      if (!isMissingTrigramExtensionError(error)) {
        throw error;
      }

      const fallbackResults = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM "GameFamily"
        WHERE LOWER(title) LIKE ${likePattern(search)}
           OR "searchTitle" LIKE ${"%" + normalizedSearch + "%"}
        ORDER BY
          CASE WHEN "searchTitle" LIKE ${"%" + normalizedSearch + "%"} THEN 0 ELSE 1 END,
          title ASC
        LIMIT ${limit}
      `;

      return fallbackResults.map((r) => r.id);
    }
  });
}

/**
 * Search bundles using case-insensitive name matching with trigram similarity.
 * Results are cached for performance.
 */
export async function searchBundles(
  prisma: PrismaClient,
  search: string,
  limit: number = 1000
): Promise<string[]> {
  const key = cacheKey(CachePrefix.BUNDLE_SEARCH, { search: search.toLowerCase(), limit });

  return getCachedOrCompute(key, CacheTTL.SEARCH_RESULTS, async () => {
    try {
      // Use trigram similarity for fuzzy matching on name when available
      const results = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM "Bundle"
        WHERE similarity(name, ${search}) > 0.1
           OR LOWER(name) LIKE ${likePattern(search)}
        ORDER BY similarity(name, ${search}) DESC, name ASC
        LIMIT ${limit}
      `;

      return results.map((r) => r.id);
    } catch (error) {
      if (!isSearchFeatureUnavailableError(error)) {
        throw error;
      }

      const fallbackResults = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM "Bundle"
        WHERE LOWER(name) LIKE ${likePattern(search)}
        ORDER BY name ASC
        LIMIT ${limit}
      `;

      return fallbackResults.map((r) => r.id);
    }
  });
}
