/**
 * Import Classic NES Series games for GBA from IGDB
 * These are NES game re-releases for Game Boy Advance
 */

import { PrismaClient, GameType } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log("=== Import Classic NES Series (GBA) ===\n");
  console.log("Mode:", DRY_RUN ? "dry-run" : "write");
  console.log("");

  // Get GBA platform
  const gbaPlatform = await prisma.platform.findUnique({
    where: { slug: "gba" },
  });

  if (!gbaPlatform) {
    console.error("GBA platform not found in database");
    return;
  }

  // Get standard version
  const standardVersion = await prisma.gameVersion.findFirst({
    where: { slug: "standard" },
  });

  if (!standardVersion) {
    console.error("Standard version not found");
    return;
  }

  // Fetch Classic NES Series games from IGDB (GBA platform = 24)
  const query = `
    fields id, name, slug, summary, cover.image_id, first_release_date, platforms.id, platforms.name;
    where platforms = (24) & name ~ *"Classic NES"*;
    sort name asc;
    limit 50;
  `;

  const igdbGames = await igdbRequest<IGDBGame[]>("games", query);

  // Filter to only GBA games (exclude web browser trivia game etc)
  const gbaGames = igdbGames.filter((g) =>
    g.platforms?.some((p) => p.id === 24)
  );

  console.log(`Found ${gbaGames.length} Classic NES Series games on IGDB:`);
  console.log("");

  for (const game of gbaGames) {
    console.log(`- ${game.name}`);
    console.log(`  Slug: ${game.slug}`);
    console.log(`  Cover: ${game.cover?.image_id ? "Yes" : "No"}`);
  }
  console.log("");

  if (DRY_RUN) {
    console.log("Dry run complete. Use without --dry-run to import.");
    return;
  }

  // Check which already exist
  const existingFamilies = await prisma.gameFamily.findMany({
    where: {
      OR: gbaGames.map((g) => ({
        title: { equals: g.name, mode: "insensitive" as const },
      })),
    },
    select: { title: true },
  });

  const existingTitles = new Set(
    existingFamilies.map((f) => f.title.toLowerCase())
  );

  const toImport = gbaGames.filter(
    (g) => !existingTitles.has(g.name.toLowerCase())
  );

  console.log(`Already exist: ${existingFamilies.length}`);
  console.log(`To import: ${toImport.length}`);
  console.log("");

  if (toImport.length === 0) {
    console.log("Nothing to import.");
    return;
  }

  // Check for slug conflicts
  const existingSlugs = new Set(
    (
      await prisma.gameFamily.findMany({
        select: { slug: true },
      })
    ).map((f) => f.slug)
  );

  let imported = 0;

  for (const game of toImport) {
    const releaseDate = game.first_release_date
      ? new Date(game.first_release_date * 1000)
      : null;

    const coverUrl = game.cover?.image_id
      ? getCoverUrl(game.cover.image_id, "cover_big")
      : null;

    // Ensure unique slug
    let slug = game.slug || game.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    let counter = 1;
    while (existingSlugs.has(slug)) {
      slug = `${game.slug}-${counter}`;
      counter++;
    }
    existingSlugs.add(slug);

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Create GameFamily
        const family = await tx.gameFamily.create({
          data: {
            title: game.name,
            slug,
            description: game.summary || null,
            coverUrl,
            releaseDate,
            type: GameType.BASE_GAME,
          },
        });

        // Create Game for GBA
        const gameRecord = await tx.game.create({
          data: {
            gameFamilyId: family.id,
            platformId: gbaPlatform.id,
            releaseDate,
          },
        });

        // Link to standard version
        await tx.$executeRaw`
          INSERT INTO "_GameVersionGames" ("A", "B")
          VALUES (${gameRecord.id}, ${standardVersion.id})
          ON CONFLICT DO NOTHING
        `;

        return { family, game: gameRecord };
      });

      console.log(`Imported: ${game.name}`);
      console.log(`  Family ID: ${result.family.id}`);
      imported++;
    } catch (error) {
      console.error(`Failed to import ${game.name}:`, error);
    }
  }

  console.log("");
  console.log(`Successfully imported ${imported} games.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
