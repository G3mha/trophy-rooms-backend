import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Get all Zelda-related games
  const games = await prisma.gameFamily.findMany({
    where: {
      OR: [
        { title: { contains: "Zelda", mode: "insensitive" } },
        { title: { contains: "Hyrule", mode: "insensitive" } }
      ]
    },
    include: {
      games: {
        include: { platform: { select: { name: true, slug: true } } }
      }
    },
    orderBy: { title: "asc" }
  });

  console.log("=== All Zelda games in database ===\n");

  const switchGames: string[] = [];
  const nonSwitchGames: string[] = [];

  for (const gf of games) {
    const platforms = gf.games.map(g => g.platform?.name).filter(Boolean);
    const hasSwitch = gf.games.some(g => g.platform?.slug === "switch");

    if (hasSwitch) {
      switchGames.push(gf.title);
    } else {
      nonSwitchGames.push(`${gf.title} [${platforms.join(", ")}]`);
    }
  }

  console.log("ON SWITCH:");
  switchGames.forEach(g => console.log(`  ✅ ${g}`));

  console.log("\nNOT ON SWITCH:");
  nonSwitchGames.forEach(g => console.log(`  - ${g}`));

  console.log(`\nTotal: ${games.length} games (${switchGames.length} on Switch)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
