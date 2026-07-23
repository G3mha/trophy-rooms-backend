import { PrismaClient } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

const GAMES_TO_UPDATE = [
  {
    title: "The Legend of Zelda: Breath of the Wild",
    igdbSlug: "the-legend-of-zelda-breath-of-the-wild-nintendo-switch-2-edition",
    versionName: "Nintendo Switch 2 Edition",
    versionSlug: "switch-2-edition-botw"
  },
  {
    title: "The Legend of Zelda: Tears of the Kingdom",
    igdbSlug: "the-legend-of-zelda-tears-of-the-kingdom-nintendo-switch-2-edition",
    versionName: "Nintendo Switch 2 Edition",
    versionSlug: "switch-2-edition-totk"
  },
  {
    title: "Animal Crossing: New Horizons",
    igdbSlug: "animal-crossing-new-horizons-nintendo-switch-2-edition",
    versionName: "Nintendo Switch 2 Edition",
    versionSlug: "switch-2-edition-acnh"
  },
  {
    title: "Super Mario Bros. Wonder",
    igdbSlug: "super-mario-bros-wonder-nintendo-switch-2-edition-plus-meetup-in-bellabel-park",
    versionName: "Nintendo Switch 2 Edition + Meetup in Bellabel Park",
    versionSlug: "switch-2-edition-wonder-bellabel"
  }
];

async function main() {
  const switch2Platform = await prisma.platform.findFirst({
    where: { slug: "switch-2" }
  });

  if (!switch2Platform) {
    console.log("Switch 2 platform not found!");
    return;
  }

  for (const game of GAMES_TO_UPDATE) {
    console.log(`\n=== ${game.title} ===`);

    // Get the GameFamily
    const gameFamily = await prisma.gameFamily.findFirst({
      where: { title: { equals: game.title, mode: "insensitive" } }
    });

    if (!gameFamily) {
      console.log(`❌ GameFamily not found in database`);
      continue;
    }

    // Get cover from IGDB
    const query = `
      fields id, name, slug, cover.image_id;
      where slug = "${game.igdbSlug}";
      limit 1;
    `;

    const results = await igdbRequest<IGDBGame[]>("games", query);
    const igdbGame = results[0];

    if (!igdbGame || !igdbGame.cover?.image_id) {
      console.log(`❌ No cover found on IGDB for slug: ${game.igdbSlug}`);
      continue;
    }

    const coverUrl = getCoverUrl(igdbGame.cover.image_id, "cover_big");
    console.log(`Found IGDB: ${igdbGame.name}`);
    console.log(`Cover: ${coverUrl}`);

    // Get or create the version
    let version = await prisma.gameVersion.findFirst({
      where: { slug: game.versionSlug }
    });

    if (!version) {
      version = await prisma.gameVersion.create({
        data: {
          name: game.versionName,
          slug: game.versionSlug,
          isDefault: false
        }
      });
      console.log(`Created version: ${version.name}`);
    }

    // Check if Switch 2 game entry exists
    let switch2Game = await prisma.game.findFirst({
      where: {
        gameFamilyId: gameFamily.id,
        platformId: switch2Platform.id
      }
    });

    if (switch2Game) {
      // Update existing entry
      await prisma.game.update({
        where: { id: switch2Game.id },
        data: { coverUrl }
      });
      console.log(`✅ Updated existing Switch 2 entry with cover`);
    } else {
      // Create new Switch 2 entry
      switch2Game = await prisma.game.create({
        data: {
          gameFamilyId: gameFamily.id,
          platformId: switch2Platform.id,
          coverUrl,
          releaseDate: new Date("2025-06-05")
        }
      });
      console.log(`✅ Created new Switch 2 entry with cover`);
    }

    // Link to version
    await prisma.$executeRaw`
      INSERT INTO "_GameVersionGames" ("A", "B")
      VALUES (${switch2Game.id}, ${version.id})
      ON CONFLICT DO NOTHING
    `;
    console.log(`✅ Linked to version: ${version.name}`);

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log("\n=== Done ===");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
