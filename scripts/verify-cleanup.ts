import { PrismaClient } from "@prisma/client";
import { searchGameByTitle, IGDB_PLATFORM_MAP } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

const HIGH_SHOVELWARE_PLATFORMS = ["pc", "android", "ios", "linux", "macos"];

async function main() {
  console.log("=== Verifying Cleanup Results ===\n");

  const platforms = await prisma.platform.findMany();
  const _platformMap = new Map(platforms.map((p) => [p.id, p]));

  // Sample games from high-shovelware platforms
  for (const slug of HIGH_SHOVELWARE_PLATFORMS) {
    const platform = platforms.find((p) => p.slug === slug);
    if (!platform) continue;

    console.log(`\n--- ${platform.name} (${slug}) ---`);

    // Get 5 random games from this platform
    const games = await prisma.game.findMany({
      where: { platformId: platform.id },
      take: 5,
      orderBy: { title: "asc" },
    });

    let passed = 0;
    let failed = 0;

    for (const game of games) {
      const igdbPlatformIds = IGDB_PLATFORM_MAP[slug];
      const igdbGame = await searchGameByTitle(game.title, igdbPlatformIds);

      if (igdbGame) {
        const ratingCount = igdbGame.rating_count || 0;
        const status = ratingCount >= 25 ? "✓" : "✗";
        if (ratingCount >= 25) passed++;
        else failed++;
        console.log(`  ${status} "${game.title}" - ${ratingCount} reviews`);
      } else {
        console.log(`  ? "${game.title}" - Not found on IGDB`);
      }

      // Rate limit
      await new Promise((r) => setTimeout(r, 300));
    }

    console.log(`  Result: ${passed} passed, ${failed} failed`);
  }

  // Also check a few games from non-high-shovelware platforms
  console.log("\n--- Console Platforms (should have cover OR rating) ---");

  const switchPlatform = platforms.find((p) => p.slug === "switch");
  if (switchPlatform) {
    const games = await prisma.game.findMany({
      where: { platformId: switchPlatform.id },
      take: 5,
      orderBy: { title: "asc" },
    });

    for (const game of games) {
      const igdbGame = await searchGameByTitle(game.title, IGDB_PLATFORM_MAP["switch"]);
      if (igdbGame) {
        const hasCover = !!igdbGame.cover?.image_id;
        const hasRating = (igdbGame.rating_count || 0) > 0;
        const status = hasCover || hasRating ? "✓" : "✗";
        console.log(`  ${status} "${game.title}" - cover: ${hasCover}, ratings: ${igdbGame.rating_count || 0}`);
      } else {
        console.log(`  ? "${game.title}" - Not found on IGDB`);
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  console.log("\n=== Verification Complete ===");
  await prisma.$disconnect();
}

main().catch(console.error);
