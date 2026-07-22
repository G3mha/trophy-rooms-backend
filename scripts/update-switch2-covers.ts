import { PrismaClient } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

async function main() {
  // Get all Switch 2 game entries
  const switch2Games = await prisma.game.findMany({
    where: { platform: { slug: "switch-2" } },
    include: {
      gameFamily: true,
      platform: true
    }
  });

  console.log(`Found ${switch2Games.length} Switch 2 game entries\n`);

  for (const game of switch2Games) {
    console.log(`\n${game.gameFamily.title}`);
    console.log(`  Current cover: ${game.coverUrl || "None (using GameFamily cover)"}`);

    // Search IGDB for Switch 2 version
    const searchTerms = [
      `${game.gameFamily.title} Switch 2`,
      `${game.gameFamily.title} Nintendo Switch 2`
    ];

    let foundCover: string | null = null;
    let foundName: string | null = null;

    for (const search of searchTerms) {
      const query = `
        fields id, name, slug, cover.image_id, platforms.name;
        search "${search.replace(/"/g, '\\"')}";
        where platforms.name = "Nintendo Switch 2";
        limit 5;
      `;

      try {
        const results = await igdbRequest<IGDBGame[]>("games", query);

        // Find best match - prioritize ones with Switch 2 in name or matching title
        for (const result of results) {
          if (result.cover?.image_id) {
            // Check if this is likely a Switch 2 edition
            const isSwitch2Edition = result.name.toLowerCase().includes("switch 2") ||
              result.name.toLowerCase().includes("nintendo switch 2");

            // Or if title matches closely
            const titleMatch = result.name.toLowerCase().includes(
              game.gameFamily.title.toLowerCase().split(":")[0].trim()
            );

            if (isSwitch2Edition || titleMatch) {
              foundCover = getCoverUrl(result.cover.image_id, "cover_big");
              foundName = result.name;
              break;
            }
          }
        }

        if (foundCover) break;
      } catch {
        // Continue to next search term
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    if (foundCover && foundCover !== game.coverUrl) {
      await prisma.game.update({
        where: { id: game.id },
        data: { coverUrl: foundCover }
      });
      console.log(`  ✅ Updated cover from: ${foundName}`);
      console.log(`     ${foundCover}`);
    } else if (game.coverUrl) {
      console.log(`  ⏭️  Already has cover`);
    } else {
      console.log(`  ⚠️  No Switch 2 specific cover found on IGDB`);
    }

    // Rate limiting between games
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log("\n=== Done ===");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
