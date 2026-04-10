import { PrismaClient } from "@prisma/client";
import {
  CachePrefix,
  CacheTTL,
  cacheKey,
  getCachedOrCompute,
} from "./cache.js";

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
 * Search games using PostgreSQL full-text search (uncached).
 * Returns game IDs ordered by relevance.
 *
 * Uses custom weights to heavily prioritize title matches over description:
 * - Weight A (title): 1.0 (highest)
 * - Weight B (description): 0.1
 * - Weight C (developer/publisher): 0.05
 * - Weight D (genre): 0.01
 *
 * Also uses normalization flag 32 to account for document length,
 * preventing long descriptions from outranking short title matches.
 */
async function searchGamesFullTextUncached(
  prisma: PrismaClient,
  search: string,
  limit: number
): Promise<string[]> {
  const tsquery = toTsQuery(search);
  if (!tsquery) return [];

  // Custom weights: {D, C, B, A} - heavily favor title (A) matches
  // Default is {0.1, 0.2, 0.4, 1.0}, we use {0.01, 0.05, 0.1, 1.0}
  // Normalization 32 = divide by (1 + log(document length)) to not favor long text
  const results = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id
    FROM "Game"
    WHERE search_vector @@ to_tsquery('english', ${tsquery})
    ORDER BY ts_rank('{0.01, 0.05, 0.1, 1.0}', search_vector, to_tsquery('english', ${tsquery}), 32) DESC
    LIMIT ${limit}
  `;

  return results.map((r) => r.id);
}

/**
 * Search games with trigram similarity for fuzzy matching (uncached).
 * Useful when full-text search returns no results.
 */
async function searchGamesFuzzyUncached(
  prisma: PrismaClient,
  search: string,
  limit: number
): Promise<string[]> {
  const results = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id
    FROM "Game"
    WHERE similarity(title, ${search}) > 0.1
    ORDER BY similarity(title, ${search}) DESC
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
    // Use trigram similarity for fuzzy matching on title
    const results = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM "GameFamily"
      WHERE similarity(title, ${search}) > 0.1
         OR LOWER(title) LIKE ${"%" + search.toLowerCase() + "%"}
      ORDER BY similarity(title, ${search}) DESC, title ASC
      LIMIT ${limit}
    `;

    return results.map((r) => r.id);
  });
}
