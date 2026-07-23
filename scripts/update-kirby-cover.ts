import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // The correct cover URL from IGDB for Switch 2 Edition
  const coverUrl = "https://images.igdb.com/igdb/image/upload/t_cover_big/co9m76.jpg";

  // Get the Switch 2 Kirby game entry
  const game = await prisma.game.findFirst({
    where: {
      gameFamily: { title: "Kirby and the Forgotten Land" },
      platform: { slug: "switch-2" }
    },
    include: { platform: true, gameFamily: true }
  });

  if (!game) {
    console.log("Switch 2 game entry not found!");
    return;
  }

  console.log(`Found: ${game.gameFamily.title} (${game.platform?.name})`);
  console.log(`Current cover: ${game.coverUrl || "None (using GameFamily cover)"}`);

  // Update with the correct cover
  await prisma.game.update({
    where: { id: game.id },
    data: { coverUrl }
  });

  console.log(`✅ Updated cover to: ${coverUrl}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
