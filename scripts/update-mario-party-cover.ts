import { PrismaClient } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

async function main() {
  // Search for Mario Party Jamboree Switch 2 on IGDB
  const query = `
    fields id, name, slug, cover.image_id, platforms.name;
    search "Mario Party Jamboree Switch 2";
    limit 10;
  `;

  const results = await igdbRequest<IGDBGame[]>("games", query);

  console.log("IGDB search results:");
  for (const game of results) {
    const coverUrl = game.cover?.image_id
      ? getCoverUrl(game.cover.image_id, "cover_big")
      : "No cover";
    console.log(`  - ${game.name} (${game.slug})`);
    console.log(`    Cover: ${coverUrl}`);
    if (game.platforms) {
      console.log(`    Platforms: ${game.platforms.map(p => p.name).join(", ")}`);
    }
  }

  // Find the Switch 2 edition
  const switch2Edition = results.find(r =>
    r.name.toLowerCase().includes("switch 2") && r.cover?.image_id
  );

  if (switch2Edition) {
    const coverUrl = getCoverUrl(switch2Edition.cover!.image_id, "cover_big");

    // Update the game entry
    const game = await prisma.game.findFirst({
      where: {
        gameFamily: { title: { contains: "Mario Party Jamboree", mode: "insensitive" } },
        platform: { slug: "switch-2" }
      },
      include: { gameFamily: true }
    });

    if (game) {
      await prisma.game.update({
        where: { id: game.id },
        data: { coverUrl }
      });
      console.log(`\n✅ Updated ${game.gameFamily.title} Switch 2 cover`);
      console.log(`   ${coverUrl}`);
    } else {
      console.log("\n⚠️ Mario Party Jamboree Switch 2 entry not found in database");
    }
  } else {
    console.log("\n⚠️ No Switch 2 edition found on IGDB");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
