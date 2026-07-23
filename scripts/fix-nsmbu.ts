import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find the Switch 2 entry for NSMBU Deluxe
  const game = await prisma.game.findFirst({
    where: {
      gameFamily: { title: { contains: "New Super Mario Bros. U Deluxe", mode: "insensitive" } },
      platform: { slug: "switch-2" }
    },
    include: { gameFamily: true, platform: true }
  });

  if (!game) {
    console.log("No Switch 2 entry found");
    return;
  }

  console.log(`Found: ${game.gameFamily.title} - ${game.platform?.name}`);

  // Delete version links first
  await prisma.$executeRaw`
    DELETE FROM "_GameVersionGames" WHERE "A" = ${game.id}
  `;

  // Delete the game entry
  await prisma.game.delete({
    where: { id: game.id }
  });

  console.log("✅ Removed incorrect Switch 2 entry");

  // Verify
  const remaining = await prisma.game.findMany({
    where: {
      gameFamily: { title: { contains: "New Super Mario Bros. U Deluxe", mode: "insensitive" } }
    },
    include: { platform: true }
  });

  console.log("\nRemaining platforms:");
  for (const g of remaining) {
    console.log(`  - ${g.platform?.name}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
