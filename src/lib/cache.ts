import { getRedis } from "./redis.js";

/**
 * Cache key prefixes for different entity types.
 * Using prefixes allows efficient pattern-based invalidation.
 */
export const CachePrefix = {
  GAME_SEARCH: "search:games:",
  GAME_FAMILY_SEARCH: "search:game-families:",
  ACHIEVEMENT_SEARCH: "search:achievements:",
  GAME_VERSION_SEARCH: "search:versions:",
  DLC_SEARCH: "search:dlcs:",
  BUNDLE_SEARCH: "search:bundles:",
  GLOBAL_SEARCH: "search:global:",
  AUTOCOMPLETE_GAMES: "autocomplete:games:",
  AUTOCOMPLETE_ACHIEVEMENTS: "autocomplete:achievements:",
} as const;

/**
 * Cache TTLs in seconds.
 */
export const CacheTTL = {
  SEARCH_RESULTS: 5 * 60, // 5 minutes - search results change moderately
  AUTOCOMPLETE: 10 * 60, // 10 minutes - autocomplete can be slightly stale
} as const;

/**
 * Generate a cache key from prefix and parameters.
 * Normalizes the key to ensure consistent caching.
 */
export function cacheKey(prefix: string, params: Record<string, unknown>): string {
  // Sort keys for consistent ordering
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      const value = params[key];
      if (value !== undefined && value !== null && value !== "") {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, unknown>);

  return `${prefix}${JSON.stringify(sortedParams)}`;
}

/**
 * Get cached value.
 * Returns null if cache miss or Redis unavailable.
 */
export async function getCache<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const cached = await redis.get(key);
    if (!cached) return null;
    return JSON.parse(cached) as T;
  } catch (error) {
    console.error("Cache get error:", error);
    return null;
  }
}

/**
 * Set cached value with TTL.
 */
export async function setCache<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    console.error("Cache set error:", error);
  }
}

/**
 * Delete a specific cache key.
 */
export async function deleteCache(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.del(key);
  } catch (error) {
    console.error("Cache delete error:", error);
  }
}

/**
 * Invalidate all cache keys matching a pattern.
 * Uses SCAN for production-safe iteration (non-blocking).
 *
 * @param pattern - Redis pattern (e.g., "search:games:*")
 */
export async function invalidateCachePattern(pattern: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;

  try {
    let cursor = "0";
    let deletedCount = 0;
    const keysToDelete: string[] = [];

    // Use SCAN to find matching keys (non-blocking)
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      keysToDelete.push(...keys);
    } while (cursor !== "0");

    // Delete keys in batches
    if (keysToDelete.length > 0) {
      // Use pipeline for batch deletion
      const pipeline = redis.pipeline();
      for (const key of keysToDelete) {
        pipeline.del(key);
      }
      await pipeline.exec();
      deletedCount = keysToDelete.length;
    }

    return deletedCount;
  } catch (error) {
    console.error("Cache invalidation error:", error);
    return 0;
  }
}

// ============================================
// CACHE INVALIDATION POLICIES
// ============================================

/**
 * Invalidate all game-related search caches.
 * Call this when a game is created, updated, or deleted.
 */
export async function invalidateGameCaches(): Promise<void> {
  await Promise.all([
    invalidateCachePattern(`${CachePrefix.GAME_SEARCH}*`),
    invalidateCachePattern(`${CachePrefix.AUTOCOMPLETE_GAMES}*`),
  ]);
}

/**
 * Invalidate all achievement-related search caches.
 * Call this when an achievement is created, updated, or deleted.
 */
export async function invalidateAchievementCaches(): Promise<void> {
  await Promise.all([
    invalidateCachePattern(`${CachePrefix.ACHIEVEMENT_SEARCH}*`),
    invalidateCachePattern(`${CachePrefix.AUTOCOMPLETE_ACHIEVEMENTS}*`),
  ]);
}

/**
 * Invalidate all game version search caches.
 * Call this when a game version is created, updated, or deleted.
 */
export async function invalidateGameVersionCaches(): Promise<void> {
  await invalidateCachePattern(`${CachePrefix.GAME_VERSION_SEARCH}*`);
}

/**
 * Invalidate all DLC search caches.
 * Call this when a DLC is created, updated, or deleted.
 */
export async function invalidateDLCCaches(): Promise<void> {
  await invalidateCachePattern(`${CachePrefix.DLC_SEARCH}*`);
}

/**
 * Invalidate all caches.
 * Use sparingly - only for major data migrations or admin operations.
 */
export async function invalidateAllCaches(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.flushdb();
    console.log("All caches invalidated");
  } catch (error) {
    console.error("Failed to flush cache:", error);
  }
}

// ============================================
// CACHED SEARCH HELPERS
// ============================================

/**
 * Get or compute cached search results.
 * This is the main caching pattern used by search queries.
 */
export async function getCachedOrCompute<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>
): Promise<T> {
  // Try cache first
  const cached = await getCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Compute fresh result
  const result = await compute();

  // Cache the result (don't await - fire and forget)
  setCache(key, result, ttlSeconds).catch(() => {});

  return result;
}
