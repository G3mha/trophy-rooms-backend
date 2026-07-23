import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Get Kirby and the Forgotten Land GameFamily
  const gameFamily = await prisma.gameFamily.findFirst({
    where: { title: "Kirby and the Forgotten Land" }
  });

  if (!gameFamily) {
    console.log("GameFamily not found!");
    return;
  }
  console.log(`Found GameFamily: ${gameFamily.title} (${gameFamily.id})`);

  // Get Switch 2 platform
  const switch2 = await prisma.platform.findFirst({
    where: { slug: "switch-2" }
  });

  if (!switch2) {
    console.log("Switch 2 platform not found!");
    return;
  }
  console.log(`Found platform: ${switch2.name} (${switch2.id})`);

  // Check if Switch 2 entry already exists
  const existing = await prisma.game.findFirst({
    where: {
      gameFamilyId: gameFamily.id,
      platformId: switch2.id
    }
  });

  if (existing) {
    console.log("Switch 2 entry already exists!");
    return;
  }

  // Create or get "Deluxe Edition" version for games that include DLC
  let deluxeVersion = await prisma.gameVersion.findFirst({
    where: { slug: "deluxe-edition" }
  });

  if (!deluxeVersion) {
    deluxeVersion = await prisma.gameVersion.create({
      data: {
        name: "Deluxe Edition",
        slug: "deluxe-edition",
        isDefault: false
      }
    });
    console.log(`Created version: ${deluxeVersion.name}`);
  } else {
    console.log(`Found version: ${deluxeVersion.name}`);
  }

  // Create Switch 2 game entry
  const game = await prisma.game.create({
    data: {
      gameFamilyId: gameFamily.id,
      platformId: switch2.id,
      releaseDate: new Date("2025-06-05") // Switch 2 launch date
    }
  });

  // Link to Deluxe Edition version
  await prisma.$executeRaw`
    INSERT INTO "_GameVersionGames" ("A", "B")
    VALUES (${game.id}, ${deluxeVersion.id})
    ON CONFLICT DO NOTHING
  `;

  console.log(`✅ Created Switch 2 game entry: ${game.id}`);
  console.log(`   Version: ${deluxeVersion.name} (includes DLC)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
