import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Get the Kirby GameFamily
  const gameFamily = await prisma.gameFamily.findFirst({
    where: { title: "Kirby and the Forgotten Land" },
    include: {
      games: {
        where: { platform: { slug: "switch-2" } },
        include: { versions: true }
      }
    }
  });

  if (!gameFamily) {
    console.log("GameFamily not found!");
    return;
  }

  const switch2Game = gameFamily.games[0];
  if (!switch2Game) {
    console.log("Switch 2 game entry not found!");
    return;
  }

  console.log(`Found Switch 2 entry: ${switch2Game.id}`);

  // Remove the incorrect "Deluxe Edition" version link
  const deluxeVersion = await prisma.gameVersion.findFirst({
    where: { slug: "deluxe-edition" }
  });

  if (deluxeVersion) {
    await prisma.$executeRaw`
      DELETE FROM "_GameVersionGames"
      WHERE "A" = ${switch2Game.id} AND "B" = ${deluxeVersion.id}
    `;
    console.log("Removed Deluxe Edition version link");
  }

  // Create the correct version: "Nintendo Switch 2 Edition + Star-Crossed World"
  let switch2Edition = await prisma.gameVersion.findFirst({
    where: { slug: "switch-2-edition-star-crossed-world" }
  });

  if (!switch2Edition) {
    switch2Edition = await prisma.gameVersion.create({
      data: {
        name: "Nintendo Switch 2 Edition + Star-Crossed World",
        slug: "switch-2-edition-star-crossed-world",
        isDefault: false
      }
    });
    console.log(`Created version: ${switch2Edition.name}`);
  }

  // Link to correct version
  await prisma.$executeRaw`
    INSERT INTO "_GameVersionGames" ("A", "B")
    VALUES (${switch2Game.id}, ${switch2Edition.id})
    ON CONFLICT DO NOTHING
  `;

  // Update release date (August 28, 2025)
  await prisma.game.update({
    where: { id: switch2Game.id },
    data: { releaseDate: new Date("2025-08-28") }
  });

  console.log(`✅ Updated Switch 2 entry with correct version`);
  console.log(`   Version: ${switch2Edition.name}`);
  console.log(`   Release: August 28, 2025`);
  console.log(`\nStar-Crossed World DLC includes:`);
  console.log(`   - New story campaign (remixed maps with meteor/crystal overlay)`);
  console.log(`   - The Ultimate Cup Z EX (new boss rush mode)`);
  console.log(`   - Starry Coins & Astronomer Waddle Dee figures`);
  console.log(`   - Three new Mouthful Modes`);
  console.log(`   - 60fps, 1440p TV / 1080p handheld`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
