import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Get the existing GameFamily for Link's Awakening
  const gameFamily = await prisma.gameFamily.findFirst({
    where: { title: { contains: "Link's Awakening", mode: "insensitive" } }
  });

  if (!gameFamily) {
    console.log("GameFamily not found!");
    return;
  }

  console.log(`Found GameFamily: ${gameFamily.title} (${gameFamily.id})`);

  // Get Nintendo Switch platform
  const switchPlatform = await prisma.platform.findFirst({
    where: { slug: "switch" }
  });

  if (!switchPlatform) {
    console.log("Nintendo Switch platform not found!");
    return;
  }

  console.log(`Found platform: ${switchPlatform.name} (${switchPlatform.id})`);

  // Check if Switch game already exists
  const existingGame = await prisma.game.findFirst({
    where: {
      gameFamilyId: gameFamily.id,
      platformId: switchPlatform.id
    }
  });

  if (existingGame) {
    console.log("Switch version already exists!");
    return;
  }

  // Get or create standard version
  let standardVersion = await prisma.gameVersion.findFirst({
    where: { slug: "standard" }
  });

  if (!standardVersion) {
    standardVersion = await prisma.gameVersion.create({
      data: {
        name: "Standard",
        slug: "standard",
        isDefault: true
      }
    });
  }

  // Create the Switch game entry
  // The Switch remake was released September 20, 2019
  const game = await prisma.game.create({
    data: {
      gameFamilyId: gameFamily.id,
      platformId: switchPlatform.id,
      releaseDate: new Date("2019-09-20")
    }
  });

  // Link to Standard version
  await prisma.$executeRaw`
    INSERT INTO "_GameVersionGames" ("A", "B")
    VALUES (${game.id}, ${standardVersion.id})
    ON CONFLICT DO NOTHING
  `;

  console.log(`✅ Created Nintendo Switch game entry: ${game.id}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
