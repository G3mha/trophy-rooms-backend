import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Comprehensive list of gaming platforms
const platforms = [
  // Nintendo Consoles
  { name: "Nintendo Entertainment System", slug: "nes" },
  { name: "Super Nintendo Entertainment System", slug: "snes" },
  { name: "Nintendo 64", slug: "n64" },
  { name: "Nintendo GameCube", slug: "gamecube" },
  { name: "Wii", slug: "wii" },
  { name: "Wii U", slug: "wii-u" },
  { name: "Nintendo Switch", slug: "switch" },

  // Nintendo Handhelds
  { name: "Game Boy", slug: "game-boy" },
  { name: "Game Boy Color", slug: "game-boy-color" },
  { name: "Game Boy Advance", slug: "gba" },
  { name: "Nintendo DS", slug: "nds" },
  { name: "Nintendo 3DS", slug: "3ds" },

  // PlayStation Consoles
  { name: "PlayStation", slug: "ps1" },
  { name: "PlayStation 2", slug: "ps2" },
  { name: "PlayStation 3", slug: "ps3" },
  { name: "PlayStation 4", slug: "ps4" },
  { name: "PlayStation 5", slug: "ps5" },

  // PlayStation Handhelds
  { name: "PlayStation Portable", slug: "psp" },
  { name: "PlayStation Vita", slug: "vita" },

  // Xbox Consoles
  { name: "Xbox", slug: "xbox" },
  { name: "Xbox 360", slug: "xbox-360" },
  { name: "Xbox One", slug: "xbox-one" },
  { name: "Xbox Series X|S", slug: "xbox-series" },

  // Sega Consoles
  { name: "Sega Master System", slug: "master-system" },
  { name: "Sega Genesis", slug: "genesis" },
  { name: "Sega Saturn", slug: "saturn" },
  { name: "Sega Dreamcast", slug: "dreamcast" },

  // Sega Handhelds
  { name: "Sega Game Gear", slug: "game-gear" },

  // PC Platforms
  { name: "PC (Windows)", slug: "pc" },
  { name: "macOS", slug: "macos" },
  { name: "Linux", slug: "linux" },

  // PC Storefronts (as platforms for achievement tracking)
  { name: "Steam", slug: "steam" },
  { name: "Epic Games Store", slug: "epic" },
  { name: "GOG", slug: "gog" },

  // Other
  { name: "iOS", slug: "ios" },
  { name: "Android", slug: "android" },
  { name: "Atari 2600", slug: "atari-2600" },
  { name: "Atari 7800", slug: "atari-7800" },
  { name: "Neo Geo", slug: "neo-geo" },
  { name: "TurboGrafx-16", slug: "turbografx-16" },
];

async function main() {
  console.log("=== Platform Seeder ===\n");

  // Create or update platforms
  let created = 0;
  let updated = 0;

  for (const platform of platforms) {
    const existing = await prisma.platform.findUnique({
      where: { slug: platform.slug },
    });

    if (existing) {
      await prisma.platform.update({
        where: { slug: platform.slug },
        data: { name: platform.name },
      });
      updated++;
    } else {
      await prisma.platform.create({
        data: platform,
      });
      created++;
    }
  }

  console.log(`Platforms created: ${created}`);
  console.log(`Platforms updated: ${updated}`);

  // Get the Nintendo Switch platform
  const switchPlatform = await prisma.platform.findUnique({
    where: { slug: "switch" },
  });

  if (!switchPlatform) {
    console.error("Nintendo Switch platform not found!");
    return;
  }

  // Update all games without a platform to be Nintendo Switch
  // (since they were seeded from IGDB's Nintendo Switch catalog)
  const result = await prisma.game.updateMany({
    where: { platformId: null },
    data: { platformId: switchPlatform.id },
  });

  console.log(`\nGames updated with Nintendo Switch platform: ${result.count}`);

  // Final stats
  const platformCount = await prisma.platform.count();
  const gamesWithPlatform = await prisma.game.count({
    where: { platformId: { not: null } },
  });
  const gamesWithoutPlatform = await prisma.game.count({
    where: { platformId: null },
  });

  console.log("\n=== Final Stats ===");
  console.log(`Total platforms: ${platformCount}`);
  console.log(`Games with platform: ${gamesWithPlatform}`);
  console.log(`Games without platform: ${gamesWithoutPlatform}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
