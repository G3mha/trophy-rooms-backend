/**
 * Import Castlevania Collections from IGDB
 * These are compilation releases for modern platforms
 */

import { PrismaClient, GameType } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");

// Castlevania collection slugs
const COLLECTION_SLUGS = [
  "castlevania-anniversary-collection",
  "castlevania-advance-collection",
  "castlevania-dominus-collection",
];

async function main() {
  console.log("=== Import Castlevania Collections ===\n");
  console.log("Mode:", DRY_RUN ? "dry-run" : "write");
  console.log("");

  // Get Switch platform
  const switchPlatform = await prisma.platform.findUnique({
    where: { slug: "switch" },
  });

  if (!switchPlatform) {
    console.error("Switch platform not found in database");
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

  console.log("Fetching Castlevania collections from IGDB...\n");

  const collections: IGDBGame[] = [];

  for (const slug of COLLECTION_SLUGS) {
    const query = `
      fields id, name, slug, summary, cover.image_id, first_release_date, platforms.id, platforms.name;
      where slug = "${slug}";
      limit 1;
    `;

    try {
      const results = await igdbRequest<IGDBGame[]>("games", query);
      if (results.length > 0) {
        collections.push(results[0]);
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    } catch (error) {
      console.error(`Failed to fetch ${slug}:`, error);
    }
  }

  console.log(`Found ${collections.length} Castlevania collections on IGDB:`);
  console.log("");

  for (const game of collections) {
    const releaseYear = game.first_release_date
      ? new Date(game.first_release_date * 1000).getFullYear()
      : "N/A";
    console.log(`- ${game.name} (${releaseYear})`);
    console.log(`  Slug: ${game.slug}`);
    console.log(`  Cover: ${game.cover?.image_id ? "Yes" : "No"}`);
    console.log(`  Platforms: ${game.platforms?.map(p => p.name).join(", ")}`);
  }
  console.log("");

  if (DRY_RUN) {
    console.log("Dry run complete. Use without --dry-run to import.");
    return;
  }

  // Check which already exist
  const existingFamilies = await prisma.gameFamily.findMany({
    where: {
      OR: collections.map(g => ({
        title: { equals: g.name, mode: "insensitive" as const },
      })),
    },
    include: {
      games: {
        where: { platformId: switchPlatform.id },
      },
    },
  });

  const existingByTitle = new Map(
    existingFamilies.map(f => [f.title.toLowerCase(), f])
  );

  // Check for slug conflicts
  const existingSlugs = new Set(
    (await prisma.gameFamily.findMany({ select: { slug: true } }))
      .map(f => f.slug)
  );

  let imported = 0;
  let addedSwitch = 0;

  for (const game of collections) {
    const releaseDate = game.first_release_date
      ? new Date(game.first_release_date * 1000)
      : null;

    const coverUrl = game.cover?.image_id
      ? getCoverUrl(game.cover.image_id, "cover_big")
      : null;

    const existing = existingByTitle.get(game.name.toLowerCase());

    if (existing) {
      // Check if Switch version exists
      if (existing.games.length > 0) {
        console.log(`Already has Switch: ${game.name}`);
        continue;
      }

      // Add Switch version to existing family
      const gameRecord = await prisma.game.create({
        data: {
          gameFamilyId: existing.id,
          platformId: switchPlatform.id,
          releaseDate,
        },
      });

      await prisma.$executeRaw`
        INSERT INTO "_GameVersionGames" ("A", "B")
        VALUES (${gameRecord.id}, ${standardVersion.id})
        ON CONFLICT DO NOTHING
      `;

      console.log(`Added Switch to existing: ${game.name}`);
      console.log(`  Game ID: ${gameRecord.id}`);
      addedSwitch++;
      continue;
    }

    // Create new family
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
            platformId: switchPlatform.id,
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
  console.log(`New families created: ${imported}`);
  console.log(`Switch versions added: ${addedSwitch}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
