import { PrismaClient } from "@prisma/client";
import {
  fetchAllNintendoSwitchGames,
  countNintendoSwitchGames,
  getCoverUrl,
  type IGDBGame,
} from "../src/lib/igdb.js";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Nintendo Switch Games Seeder (IGDB) ===\n");

  // Validate environment variables
  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
    console.error("Error: TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET are required.");
    console.error("Get your credentials at: https://dev.twitch.tv/console");
    process.exit(1);
  }

  try {
    // Get total count first
    console.log("Counting Nintendo Switch games in IGDB...");
    const totalCount = await countNintendoSwitchGames();
    console.log(`Found ${totalCount} games in IGDB\n`);

    // Check existing games in database
    const existingCount = await prisma.game.count();
    console.log(`Existing games in database: ${existingCount}\n`);

    // Fetch all games from IGDB
    const igdbGames = await fetchAllNintendoSwitchGames();

    // Get existing game titles to avoid duplicates
    const existingGames = await prisma.game.findMany({
      select: { title: true },
    });
    const existingTitles = new Set(
      existingGames.map((g) => g.title.toLowerCase())
    );

    // Filter out games that already exist
    const newGames = igdbGames.filter(
      (game) => !existingTitles.has(game.name.toLowerCase())
    );

    console.log(`\nNew games to add: ${newGames.length}`);

    if (newGames.length === 0) {
      console.log("No new games to add. Database is up to date!");
      return;
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
      }));

      try {
        const result = await prisma.game.createMany({
          data: gamesToCreate,
          skipDuplicates: true,
        });

        inserted += result.count;
        skipped += batch.length - result.count;

        console.log(
          `Progress: ${Math.min(i + batchSize, newGames.length)}/${newGames.length} processed (${inserted} inserted, ${skipped} skipped)`
        );
      } catch (error) {
        console.error(`Error inserting batch at index ${i}:`, error);
      }
    }

    console.log("\n=== Seeding Complete ===");
    console.log(`Total games inserted: ${inserted}`);
    console.log(`Total games skipped (duplicates): ${skipped}`);

    // Final count
    const finalCount = await prisma.game.count();
    console.log(`Total games in database: ${finalCount}`);
  } catch (error) {
    console.error("Seeding failed:", error);
    throw error;
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
