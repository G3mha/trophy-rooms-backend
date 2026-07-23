import { PrismaClient } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

async function main() {
  // Check database
  const dbGame = await prisma.gameFamily.findFirst({
    where: { title: { contains: "Marvel Cosmic", mode: "insensitive" } },
    include: {
      games: {
        include: { platform: true, versions: true }
      }
    }
  });

  console.log("=== Database ===");
  if (dbGame) {
    console.log(`Found: ${dbGame.title}`);
    console.log(`Cover: ${dbGame.coverUrl}`);
    console.log("Platforms:");
    for (const g of dbGame.games) {
      console.log(`  - ${g.platform?.name}: ${g.coverUrl || "(no cover)"}`);
    }
  } else {
    console.log("Not found in database");
  }

  // Check IGDB
  console.log("\n=== IGDB ===");
  const query = `
    fields id, name, slug, summary, cover.image_id, first_release_date, platforms.id, platforms.name;
    search "Marvel Cosmic Invasion";
    limit 10;
  `;

  const results = await igdbRequest<IGDBGame[]>("games", query);

  for (const game of results) {
    console.log(`\n${game.name} (${game.slug})`);
    if (game.cover?.image_id) {
      console.log(`  Cover: ${getCoverUrl(game.cover.image_id, "cover_big")}`);
    }
    if (game.platforms) {
      console.log(`  Platforms: ${game.platforms.map(p => p.name).join(", ")}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
