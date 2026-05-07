/**
 * Import Super Mario 64 DS from IGDB
 * This is a separate game from Super Mario 64 (enhanced remake with new content)
 */

import { PrismaClient, GameType } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Import Super Mario 64 DS ===\n");

  // Check if it already exists
  const existing = await prisma.gameFamily.findFirst({
    where: {
      title: { contains: "Super Mario 64 DS", mode: "insensitive" },
    },
    include: {
      games: {
        include: { platform: true },
      },
    },
  });

  if (existing) {
    console.log("Super Mario 64 DS already exists:");
    console.log("  Family ID:", existing.id);
    console.log("  Title:", existing.title);
    console.log("  Games:", existing.games.map((g) => g.platform?.name).join(", "));
    return;
  }

  // Fetch from IGDB
  const query = `
    fields id, name, slug, summary, cover.image_id, first_release_date, platforms.id, platforms.name;
    where slug = "super-mario-64-ds";
    limit 1;
  `;

  const [igdbGame] = await igdbRequest<IGDBGame[]>("games", query);

  if (!igdbGame) {
    console.error("Could not find Super Mario 64 DS on IGDB");
    return;
  }

  console.log("Found on IGDB:");
  console.log("  Title:", igdbGame.name);
  console.log("  IGDB ID:", igdbGame.id);
  console.log("  Release:", igdbGame.first_release_date
    ? new Date(igdbGame.first_release_date * 1000).toISOString().split("T")[0]
    : "N/A");
  console.log("  Cover:", igdbGame.cover?.image_id ? "Yes" : "No");
  console.log("");

  // Get the Nintendo DS platform
  const ndsPlatform = await prisma.platform.findUnique({
    where: { slug: "nds" },
  });

  if (!ndsPlatform) {
    console.error("Nintendo DS platform not found in database");
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

  // Create the family and game
  const releaseDate = igdbGame.first_release_date
    ? new Date(igdbGame.first_release_date * 1000)
    : null;

  const coverUrl = igdbGame.cover?.image_id
    ? getCoverUrl(igdbGame.cover.image_id, "cover_big")
    : null;

  const result = await prisma.$transaction(async (tx) => {
    // Create GameFamily
    const family = await tx.gameFamily.create({
      data: {
        title: igdbGame.name,
        slug: igdbGame.slug || "super-mario-64-ds",
        description: igdbGame.summary || null,
        coverUrl,
        releaseDate,
        type: GameType.BASE_GAME,
      },
    });

    // Create Game for Nintendo DS
    const game = await tx.game.create({
      data: {
        gameFamilyId: family.id,
        platformId: ndsPlatform.id,
        releaseDate,
      },
    });

    // Link to standard version
    await tx.$executeRaw`
      INSERT INTO "_GameVersionGames" ("A", "B")
      VALUES (${game.id}, ${standardVersion.id})
      ON CONFLICT DO NOTHING
    `;

    return { family, game };
  });

  console.log("Created successfully:");
  console.log("  Family ID:", result.family.id);
  console.log("  Family Title:", result.family.title);
  console.log("  Family Slug:", result.family.slug);
  console.log("  Cover URL:", result.family.coverUrl);
  console.log("  Game ID:", result.game.id);
  console.log("  Platform: Nintendo DS");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
