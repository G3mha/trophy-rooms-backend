/**
 * Import SNES to GBA ports from IGDB
 * These are enhanced ports of SNES classics for Game Boy Advance
 */

import { PrismaClient, GameType } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");

// Known SNES to GBA ports - search terms and expected slugs
const SNES_GBA_PORTS = [
  // Super Mario Advance series
  "Super Mario Advance",
  "Super Mario World: Super Mario Advance 2",
  "Super Mario Advance 3: Yoshi's Island",
  "Super Mario Advance 4: Super Mario Bros. 3",
  // Zelda
  "The Legend of Zelda: A Link to the Past & Four Swords",
  // Donkey Kong Country series
  "Donkey Kong Country GBA",
  "Donkey Kong Country 2 GBA",
  "Donkey Kong Country 3 GBA",
  // Final Fantasy Advance
  "Final Fantasy IV Advance",
  "Final Fantasy V Advance",
  "Final Fantasy VI Advance",
  // Other notable ports
  "Super Ghouls 'n Ghosts GBA",
  "Contra Advance",
  "Breath of Fire GBA",
  "Breath of Fire II GBA",
];

async function searchGBAPort(searchTerm: string): Promise<IGDBGame | null> {
  // Search with GBA platform filter
  const query = `
    fields id, name, slug, summary, cover.image_id, first_release_date, platforms.id, platforms.name;
    search "${searchTerm}";
    where platforms = (24);
    limit 5;
  `;

  try {
    const results = await igdbRequest<IGDBGame[]>("games", query);
    // Return the first GBA result
    return results.find(g => g.platforms?.some(p => p.id === 24)) || null;
  } catch {
    return null;
  }
}

// Specific slugs for known SNES to GBA ports (curated list)
const KNOWN_SNES_GBA_PORT_SLUGS = [
  // Super Mario Advance series (all SNES ports)
  "super-mario-advance", // SMB2
  "super-mario-world-super-mario-advance-2",
  "yoshis-island-super-mario-advance-3",
  "super-mario-advance-4-super-mario-bros-3",
  // Zelda
  "the-legend-of-zelda-a-link-to-the-past-and-four-swords",
  // Donkey Kong Country GBA ports
  "donkey-kong-country--1", // GBA version
  "donkey-kong-country-2", // GBA version
  "donkey-kong-country-3", // GBA version
  // Final Fantasy Advance ports (SNES originals)
  "final-fantasy-iv-advance",
  "final-fantasy-v-advance",
  "final-fantasy-vi-advance",
  // Other SNES to GBA ports
  "breath-of-fire--1", // GBA version
  "breath-of-fire-ii--1", // GBA version
  "contra-advance-the-alien-wars-ex", // Contra III port
];

async function fetchAllGBAPortsDirectly(): Promise<IGDBGame[]> {
  const allGames: IGDBGame[] = [];

  // Fetch by specific slugs for accuracy
  for (const slug of KNOWN_SNES_GBA_PORT_SLUGS) {
    const query = `
      fields id, name, slug, summary, cover.image_id, first_release_date, platforms.id, platforms.name;
      where slug = "${slug}" & platforms = (24);
      limit 1;
    `;

    try {
      const results = await igdbRequest<IGDBGame[]>("games", query);
      if (results.length > 0) {
        allGames.push(results[0]);
      }
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 250));
    } catch (error) {
      console.error(`Query failed for ${slug}:`, error);
    }
  }

  return allGames;
}

async function main() {
  console.log("=== Import SNES to GBA Ports ===\n");
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

  console.log("Fetching SNES to GBA ports from IGDB...\n");

  const igdbGames = await fetchAllGBAPortsDirectly();

  // Filter to only actual GBA games
  const gbaGames = igdbGames.filter(g =>
    g.platforms?.some(p => p.id === 24) && g.cover?.image_id
  );

  console.log(`Found ${gbaGames.length} potential SNES-to-GBA ports on IGDB:`);
  console.log("");

  for (const game of gbaGames) {
    const releaseYear = game.first_release_date
      ? new Date(game.first_release_date * 1000).getFullYear()
      : "N/A";
    console.log(`- ${game.name} (${releaseYear})`);
    console.log(`  Slug: ${game.slug}`);
  }
  console.log("");

  if (DRY_RUN) {
    console.log("Dry run complete. Use without --dry-run to import.");
    return;
  }

  // Check which already exist (by title OR by having a GBA game entry)
  const existingFamilies = await prisma.gameFamily.findMany({
    where: {
      OR: gbaGames.map(g => ({
        title: { equals: g.name, mode: "insensitive" as const },
      })),
    },
    include: {
      games: {
        where: { platformId: gbaPlatform.id },
      },
    },
  });

  const existingTitles = new Set(
    existingFamilies.map(f => f.title.toLowerCase())
  );

  const familiesWithGBA = new Set(
    existingFamilies.filter(f => f.games.length > 0).map(f => f.title.toLowerCase())
  );

  const toImport = gbaGames.filter(
    g => !existingTitles.has(g.name.toLowerCase())
  );

  console.log(`Already exist as families: ${existingFamilies.length}`);
  console.log(`Already have GBA versions: ${familiesWithGBA.size}`);
  console.log(`New families to create: ${toImport.length}`);
  console.log("");

  if (toImport.length === 0) {
    console.log("Nothing new to import.");
    return;
  }

  // Check for slug conflicts
  const existingSlugs = new Set(
    (await prisma.gameFamily.findMany({ select: { slug: true } }))
      .map(f => f.slug)
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

        const gameRecord = await tx.game.create({
          data: {
            gameFamilyId: family.id,
            platformId: gbaPlatform.id,
            releaseDate,
          },
        });

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
