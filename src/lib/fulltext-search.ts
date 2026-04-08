import { PrismaClient } from "@prisma/client";

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
 * Search games using PostgreSQL full-text search.
 * Returns game IDs ordered by relevance.
 */
export async function searchGamesFullText(
  prisma: PrismaClient,
  search: string,
  limit: number = 1000
): Promise<string[]> {
  const tsquery = toTsQuery(search);
  if (!tsquery) return [];

  const results = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id
    FROM "Game"
    WHERE search_vector @@ to_tsquery('english', ${tsquery})
    ORDER BY ts_rank(search_vector, to_tsquery('english', ${tsquery})) DESC
    LIMIT ${limit}
  `;

  return results.map((r) => r.id);
}

/**
 * Search games with trigram similarity for fuzzy matching.
 * Useful when full-text search returns no results.
 */
export async function searchGamesFuzzy(
  prisma: PrismaClient,
  search: string,
  limit: number = 100
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
 */
export async function searchGames(
  prisma: PrismaClient,
  search: string,
  limit: number = 1000
): Promise<string[]> {
  // Try full-text search first
  const fullTextResults = await searchGamesFullText(prisma, search, limit);

  if (fullTextResults.length > 0) {
    return fullTextResults;
  }

  // Fall back to fuzzy search for typos/partial matches
  return searchGamesFuzzy(prisma, search, limit);
}

/**
 * Search achievements using PostgreSQL full-text search.
 */
export async function searchAchievementsFullText(
  prisma: PrismaClient,
  search: string,
  limit: number = 1000
): Promise<string[]> {
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
}

/**
 * Search game versions using PostgreSQL full-text search.
 */
export async function searchGameVersionsFullText(
  prisma: PrismaClient,
  search: string,
  limit: number = 1000
): Promise<string[]> {
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
}

/**
 * Search DLCs using PostgreSQL full-text search.
 */
export async function searchDLCsFullText(
  prisma: PrismaClient,
  search: string,
  limit: number = 1000
): Promise<string[]> {
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
}
