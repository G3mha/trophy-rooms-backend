import { Redis } from "ioredis";

// Redis client singleton
let redis: Redis | null = null;

/**
 * Get Redis client instance.
 * Returns null if REDIS_URL is not configured (graceful degradation).
 */
export function getRedis(): Redis | null {
  if (redis) return redis;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn("REDIS_URL not configured - caching disabled");
    return null;
  }

  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    redis.on("error", (err: Error) => {
      console.error("Redis connection error:", err.message);
    });

    redis.on("connect", () => {
      console.log("Redis connected");
    });

    return redis;
  } catch (error) {
    console.error("Failed to create Redis client:", error);
    return null;
  }
}

/**
 * Close Redis connection gracefully.
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
