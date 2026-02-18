import { PrismaClient } from "@prisma/client";
import {
  searchGameByTitle,
  IGDB_PLATFORM_MAP,
  type IGDBGame,
} from "../src/lib/igdb.js";

let prisma = new PrismaClient();

// Reconnect to database periodically to avoid connection pool exhaustion
async function reconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
  } catch {
    // Ignore disconnect errors
  }

  // Wait a moment before creating new connection
  await new Promise(resolve => setTimeout(resolve, 1000));

  prisma = new PrismaClient();

  // Test the connection
  await prisma.$connect();
}

// Retry wrapper for database operations
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 5,
  delayMs: number = 10000
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      const errorCode = (error as { code?: string }).code;
      const errorMessage = (error as { message?: string }).message || '';
      const errorName = (error as { name?: string }).name || '';

      const isRetryable =
        errorCode === 'P1001' || // Can't reach database
        errorCode === 'P2024' || // Connection pool timeout
        errorName.includes('PrismaClient') || // Any Prisma client error
        errorMessage.toLowerCase().includes('connection') ||
        errorMessage.toLowerCase().includes('database') ||
        errorMessage.toLowerCase().includes('timeout') ||
        errorMessage.toLowerCase().includes('reach');

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      console.log(`\n[Database error: ${errorName}. Attempt ${attempt}/${maxRetries}. Waiting ${delayMs/1000}s...]`);
      await new Promise(resolve => setTimeout(resolve, delayMs));

      // Only reconnect if not the last retry
      if (attempt < maxRetries) {
        try {
          await reconnectPrisma();
        } catch {
          console.log('[Reconnection failed, will retry...]');
        }
      }
    }
  }
  throw lastError;
}

// Platform slugs that require stricter filtering (25+ reviews)
const HIGH_SHOVELWARE_PLATFORMS = ["pc", "android", "ios", "linux", "macos", "steam", "epic", "gog"];

// Minimum rating count for high-shovelware platforms
const MIN_RATING_COUNT_STRICT = 25;

interface CleanupStats {
  total: number;
  checked: number;
  deleted: number;
  kept: number;
  notFoundOnIgdb: number;
  errors: number;
}

async function shouldDeleteGame(
  game: { title: string; platformId: string | null },
  platformSlug: string | null,
  igdbGame: IGDBGame | null,
  dryRun: boolean
): Promise<{ delete: boolean; reason: string }> {
  // If not found on IGDB, keep the game
  if (!igdbGame) {
    return { delete: false, reason: "Not found on IGDB - keeping" };
  }

  const isHighShovelwarePlatform = platformSlug && HIGH_SHOVELWARE_PLATFORMS.includes(platformSlug);
  const ratingCount = igdbGame.rating_count || 0;
  const hasCover = !!igdbGame.cover?.image_id;
  const hasRating = ratingCount > 0;

  if (isHighShovelwarePlatform) {
    // Strict criteria: must have 25+ reviews
    if (ratingCount < MIN_RATING_COUNT_STRICT) {
      return {
        delete: true,
        reason: `High-shovelware platform (${platformSlug}) with only ${ratingCount} reviews (< ${MIN_RATING_COUNT_STRICT})`,
      };
    }
  } else {
    // Moderate criteria: must have cover OR at least 1 rating
    if (!hasCover && !hasRating) {
      return {
        delete: true,
        reason: "No cover image and no ratings",
      };
    }
  }

  return { delete: false, reason: "Meets quality criteria" };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const platformFilter = args.find((a) => a.startsWith("--platform="))?.split("=")[1];
  const limit = parseInt(args.find((a) => a.startsWith("--limit="))?.split("=")[1] || "0", 10);
  const startOffset = parseInt(args.find((a) => a.startsWith("--offset="))?.split("=")[1] || "0", 10);

  console.log("=== Shovelware Cleanup Script ===\n");
  console.log(`Mode: ${dryRun ? "DRY RUN (no deletions)" : "LIVE (will delete games)"}`);

  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
    console.error("Error: TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET are required.");
    process.exit(1);
  }

  // Get all platforms with their slugs
  const platforms = await withRetry(() => prisma.platform.findMany());
  const platformMap = new Map(platforms.map((p) => [p.id, p.slug]));

  console.log(`\nPlatforms loaded: ${platforms.length}`);
  console.log(`High-shovelware platforms (require ${MIN_RATING_COUNT_STRICT}+ reviews): ${HIGH_SHOVELWARE_PLATFORMS.join(", ")}`);

  // Build query for games
  const whereClause: { platformId?: string } = {};
  if (platformFilter) {
    const platform = platforms.find((p) => p.slug === platformFilter);
    if (!platform) {
      console.error(`Platform not found: ${platformFilter}`);
      process.exit(1);
    }
    whereClause.platformId = platform.id;
    console.log(`\nFiltering to platform: ${platform.name}`);
  }

  // Get total count
  const totalGames = await withRetry(() => prisma.game.count({ where: whereClause }));
  console.log(`\nTotal games to check: ${totalGames}`);

  if (startOffset > 0) {
    console.log(`Starting from offset: ${startOffset}`);
  }

  if (limit > 0) {
    console.log(`Limiting to first ${limit} games`);
  }

  const stats: CleanupStats = {
    total: totalGames,
    checked: 0,
    deleted: 0,
    kept: 0,
    notFoundOnIgdb: 0,
    errors: 0,
  };

  // Process games in batches
  const batchSize = 100;
  let offset = startOffset;
  const gamesToDelete: string[] = [];
  let reconnectCounter = 0;
  const RECONNECT_INTERVAL = 1000; // Reconnect every 1000 games
  const DELETE_BATCH_SIZE = 500; // Delete in batches to save progress

  console.log("\nStarting cleanup...\n");

  while (true) {
    const games = await withRetry(() =>
      prisma.game.findMany({
        where: whereClause,
        select: { id: true, title: true, platformId: true },
        skip: offset,
        take: batchSize,
        orderBy: { title: "asc" },
      })
    );

    if (games.length === 0) break;

    for (const game of games) {
      if (limit > 0 && stats.checked >= limit) break;

      stats.checked++;
      const platformSlug = game.platformId ? platformMap.get(game.platformId) || null : null;

      try {
        // Get IGDB platform IDs for this game's platform
        const igdbPlatformIds = platformSlug ? IGDB_PLATFORM_MAP[platformSlug] : undefined;

        // Search for game on IGDB
        const igdbGame = await searchGameByTitle(game.title, igdbPlatformIds);

        if (!igdbGame) {
          stats.notFoundOnIgdb++;
          stats.kept++;
          if (stats.checked % 100 === 0) {
            process.stdout.write(`\rProgress: ${stats.checked}/${Math.min(totalGames, limit || totalGames)} checked, ${stats.deleted} to delete, ${stats.notFoundOnIgdb} not found on IGDB`);
          }
          continue;
        }

        const { delete: shouldDelete, reason } = await shouldDeleteGame(
          game,
          platformSlug,
          igdbGame,
          dryRun
        );

        if (shouldDelete) {
          stats.deleted++;
          gamesToDelete.push(game.id);
          if (dryRun && stats.deleted <= 20) {
            console.log(`\n  [DELETE] "${game.title}" (${platformSlug || "no platform"}): ${reason}`);
          }
        } else {
          stats.kept++;
        }

        // Progress update every 100 games
        if (stats.checked % 100 === 0) {
          process.stdout.write(`\rProgress: ${stats.checked}/${Math.min(totalGames, limit || totalGames)} checked, ${stats.deleted} to delete, ${stats.notFoundOnIgdb} not found on IGDB`);
        }

        // Rate limiting (250ms between IGDB requests)
        await new Promise((resolve) => setTimeout(resolve, 250));
      } catch (error) {
        stats.errors++;
        console.error(`\nError processing "${game.title}":`, error);
      }
    }

    if (limit > 0 && stats.checked >= limit) break;
    offset += batchSize;

    // Delete games periodically to save progress (only in live mode)
    if (!dryRun && gamesToDelete.length >= DELETE_BATCH_SIZE) {
      console.log(`\n[Deleting batch of ${gamesToDelete.length} games...]`);
      await withRetry(() =>
        prisma.game.deleteMany({
          where: { id: { in: [...gamesToDelete] } },
        })
      );
      gamesToDelete.length = 0; // Clear the array
    }

    // Reconnect to database periodically to avoid connection pool exhaustion
    reconnectCounter += batchSize;
    if (reconnectCounter >= RECONNECT_INTERVAL) {
      console.log(`\n[Reconnecting to database at offset ${offset}...]`);
      try {
        await reconnectPrisma();
      } catch (error) {
        console.log(`[Reconnection failed, will retry on next operation...]`);
        // Don't reset counter - will try again on next interval
        continue;
      }
      reconnectCounter = 0;
    }
  }

  console.log("\n\n=== Cleanup Results ===");
  console.log(`Total games: ${stats.total}`);
  console.log(`Checked: ${stats.checked}`);
  console.log(`To delete: ${stats.deleted}`);
  console.log(`Kept: ${stats.kept}`);
  console.log(`Not found on IGDB: ${stats.notFoundOnIgdb}`);
  console.log(`Errors: ${stats.errors}`);

  // Delete any remaining games in the buffer
  if (!dryRun && gamesToDelete.length > 0) {
    console.log(`\nDeleting final batch of ${gamesToDelete.length} games...`);
    await withRetry(() =>
      prisma.game.deleteMany({
        where: { id: { in: gamesToDelete } },
      })
    );
    console.log("Final batch deleted!");
  } else if (dryRun) {
    console.log("\n[DRY RUN] No games were deleted. Run without --dry-run to delete.");
  }

  // Final stats
  const finalCount = await withRetry(() => prisma.game.count());
  console.log(`\nFinal game count: ${finalCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
