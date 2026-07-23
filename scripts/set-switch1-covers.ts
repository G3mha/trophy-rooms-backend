import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const GAMES = [
  "The Legend of Zelda: Breath of the Wild",
  "The Legend of Zelda: Tears of the Kingdom",
  "Animal Crossing: New Horizons",
  "Super Mario Bros. Wonder",
  "Kirby and the Forgotten Land",
  "Super Mario Party Jamboree"
];

async function main() {
  for (const title of GAMES) {
    console.log(`\n=== ${title} ===`);

    const gameFamily = await prisma.gameFamily.findFirst({
      where: { title: { equals: title, mode: "insensitive" } },
      include: {
        games: {
          include: { platform: true }
        }
      }
    });

    if (!gameFamily) {
      console.log("❌ Not found");
      continue;
    }

    // Find Switch 1 entry
    const switch1Game = gameFamily.games.find(g => g.platform?.slug === "switch");

    if (!switch1Game) {
      console.log("❌ No Switch 1 entry");
      continue;
    }

    if (switch1Game.coverUrl) {
      console.log(`✅ Switch 1 already has cover: ${switch1Game.coverUrl}`);
    } else if (gameFamily.coverUrl) {
      // Set Switch 1 cover to match GameFamily cover
      await prisma.game.update({
        where: { id: switch1Game.id },
        data: { coverUrl: gameFamily.coverUrl }
      });
      console.log(`✅ Set Switch 1 cover: ${gameFamily.coverUrl}`);
    } else {
      console.log("⚠️ No GameFamily cover to copy");
    }

    // Show Switch 2 for reference
    const switch2Game = gameFamily.games.find(g => g.platform?.slug === "switch-2");
    if (switch2Game) {
      console.log(`   Switch 2 cover: ${switch2Game.coverUrl || "(none)"}`);
    }
  }

  console.log("\n=== Done ===");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
