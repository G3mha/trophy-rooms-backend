import { PrismaClient } from "@prisma/client";
import {
  CachePrefix,
  CacheTTL,
  cacheKey,
  getCachedOrCompute,
} from "./cache.js";

function isMissingTrigramExtensionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("similarity(") || message.includes("function similarity");
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
 */
async function searchGamesFullTextUncached(
  prisma: PrismaClient,
  search: string,
  limit: number
): Promise<string[]> {
  // Use trigram similarity on GameFamily.title and return associated Game IDs
  const results = await prisma.$queryRaw<{ id: string }[]>`
    SELECT g.id
    FROM "Game" g
    JOIN "GameFamily" gf ON g."gameFamilyId" = gf.id
    WHERE similarity(gf.title, ${search}) > 0.1
       OR LOWER(gf.title) LIKE ${"%" + search.toLowerCase() + "%"}
    ORDER BY similarity(gf.title, ${search}) DESC, gf.title ASC
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
    // Try full-text search first
    const fullTextResults = await searchGamesFullTextUncached(prisma, search, limit);

    if (fullTextResults.length > 0) {
      return fullTextResults;
    }

    // Fall back to fuzzy search for typos/partial matches
    return searchGamesFuzzyUncached(prisma, search, limit);
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

    const results = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM "Achievement"
      WHERE search_vector @@ to_tsquery('english', ${tsquery})
      ORDER BY ts_rank(search_vector, to_tsquery('english', ${tsquery})) DESC
      LIMIT ${limit}
    `;

    return results.map((r) => r.id);
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

    const results = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM "GameVersion"
      WHERE search_vector @@ to_tsquery('english', ${tsquery})
      ORDER BY ts_rank(search_vector, to_tsquery('english', ${tsquery})) DESC
      LIMIT ${limit}
    `;

    return results.map((r) => r.id);
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

    const results = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM "DLC"
      WHERE search_vector @@ to_tsquery('english', ${tsquery})
      ORDER BY ts_rank(search_vector, to_tsquery('english', ${tsquery})) DESC
      LIMIT ${limit}
    `;

    return results.map((r) => r.id);
  });
}

/**
 * Search game families using case-insensitive title matching with trigram similarity.
 * Uses fuzzy matching for typo tolerance.
 * Results are cached for performance.
 */
export async function searchGameFamilies(
  prisma: PrismaClient,
  search: string,
  limit: number = 1000
): Promise<string[]> {
  const key = cacheKey(CachePrefix.GAME_FAMILY_SEARCH, { search: search.toLowerCase(), limit });

  return getCachedOrCompute(key, CacheTTL.SEARCH_RESULTS, async () => {
    try {
      // Use trigram similarity for fuzzy matching on title when available
      const results = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM "GameFamily"
        WHERE similarity(title, ${search}) > 0.1
           OR LOWER(title) LIKE ${"%" + search.toLowerCase() + "%"}
        ORDER BY similarity(title, ${search}) DESC, title ASC
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
        WHERE LOWER(title) LIKE ${"%" + search.toLowerCase() + "%"}
        ORDER BY title ASC
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
           OR LOWER(name) LIKE ${"%" + search.toLowerCase() + "%"}
        ORDER BY similarity(name, ${search}) DESC, name ASC
        LIMIT ${limit}
      `;

      return results.map((r) => r.id);
    } catch (error) {
      if (!isMissingTrigramExtensionError(error)) {
        throw error;
      }

      const fallbackResults = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM "Bundle"
        WHERE LOWER(name) LIKE ${"%" + search.toLowerCase() + "%"}
        ORDER BY name ASC
        LIMIT ${limit}
      `;

      return fallbackResults.map((r) => r.id);
    }
  });
}
