import { PrismaClient } from "@prisma/client";
import {
  fetchAllGamesForPlatform,
  getCoverUrl,
  IGDB_PLATFORM_MAP,
  QUALITY_FILTERS,
  type IGDBGame,
} from "../src/lib/igdb.js";

const prisma = new PrismaClient();

// Platforms to skip (they share IGDB IDs with other platforms)
const SKIP_PLATFORMS = ["steam", "epic", "gog"]; // These map to PC

async function main() {
  console.log("=== Multi-Platform Games Seeder (IGDB) ===\n");

  // Validate environment variables
  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
    console.error("Error: TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET are required.");
    console.error("Get your credentials at: https://dev.twitch.tv/console");
    process.exit(1);
  }

  const filter = QUALITY_FILTERS.noFilter;
  console.log("Quality filter: NO FILTER (category only)");
  console.log(`  - Min rating: ${filter.minRating || "none"}`);
  console.log(`  - Min rating count: ${filter.minRatingCount || "none"}`);
  console.log(`  - Categories: Main games, Remakes, Remasters\n`);

  // Get all platforms from database
  const platforms = await prisma.platform.findMany({
    orderBy: { name: "asc" },
  });

  console.log(`Found ${platforms.length} platforms in database\n`);

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const platform of platforms) {
    // Skip platforms that don't have unique IGDB mappings
    if (SKIP_PLATFORMS.includes(platform.slug)) {
      console.log(`\n⏭️  Skipping ${platform.name} (shares IGDB ID with PC)`);
      continue;
    }

    const igdbPlatformIds = IGDB_PLATFORM_MAP[platform.slug];

    if (!igdbPlatformIds) {
      console.log(`\n⚠️  No IGDB mapping for ${platform.name} (${platform.slug})`);
      continue;
    }

    console.log(`\n📦 Fetching games for ${platform.name}...`);

    try {
      const igdbGames = await fetchAllGamesForPlatform(
        igdbPlatformIds,
        filter,
        (count) => process.stdout.write(`\r   Fetched ${count} games...`)
      );
      console.log(`\n   Total from IGDB: ${igdbGames.length}`);

      if (igdbGames.length === 0) {
        console.log("   No games found matching quality criteria");
        continue;
      }

      // Get existing game titles for this platform to avoid duplicates
      const existingGames = await prisma.game.findMany({
        where: { platformId: platform.id },
        select: { title: true },
      });
      const existingTitles = new Set(
        existingGames.map((g) => g.title.toLowerCase())
      );

      // Filter out games that already exist
      const newGames = igdbGames.filter(
        (game) => !existingTitles.has(game.name.toLowerCase())
      );

      console.log(`   New games to add: ${newGames.length}`);

      if (newGames.length === 0) {
        console.log("   ✓ Platform is up to date!");
        continue;
      }

      // Insert games in batches
      const batchSize = 100;
      let inserted = 0;
      let skipped = 0;

      for (let i = 0; i < newGames.length; i += batchSize) {
        const batch = newGames.slice(i, i + batchSize);

        const gamesToCreate = batch.map((game: IGDBGame) => ({
          title: game.name,
          description: game.summary || null,
          coverUrl: game.cover?.image_id
            ? getCoverUrl(game.cover.image_id, "cover_big")
            : null,
          platformId: platform.id,
        }));

        try {
          const result = await prisma.game.createMany({
            data: gamesToCreate,
            skipDuplicates: true,
          });

          inserted += result.count;
          skipped += batch.length - result.count;

          process.stdout.write(
            `\r   Progress: ${Math.min(i + batchSize, newGames.length)}/${newGames.length} (${inserted} inserted)`
          );
        } catch (error) {
          console.error(`\n   Error inserting batch at index ${i}:`, error);
        }
      }

      console.log(`\n   ✓ Inserted ${inserted}, skipped ${skipped} duplicates`);
      totalInserted += inserted;
      totalSkipped += skipped;

      // Rate limiting between platforms
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`\n   Error fetching games for ${platform.name}:`, error);
    }
  }

  console.log("\n=== Seeding Complete ===");
  console.log(`Total games inserted: ${totalInserted}`);
  console.log(`Total games skipped: ${totalSkipped}`);

  // Final stats
  const finalCount = await prisma.game.count();
  const platformStats = await prisma.game.groupBy({
    by: ["platformId"],
    _count: { id: true },
  });

  console.log(`\nTotal games in database: ${finalCount}`);
  console.log("\nGames per platform:");

  for (const stat of platformStats) {
    if (stat.platformId) {
      const platform = platforms.find((p) => p.id === stat.platformId);
      if (platform) {
        console.log(`  ${platform.name}: ${stat._count.id}`);
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
