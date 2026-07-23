import { PrismaClient } from "@prisma/client";
import { igdbRequest, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

async function main() {
  // Search for Switch 2 enhanced editions on IGDB
  const query = `
    fields id, name, slug, cover.image_id;
    where name ~ *"Switch 2 Edition"* & platforms.name = "Nintendo Switch 2";
    limit 50;
  `;

  const results = await igdbRequest<IGDBGame[]>("games", query);

  console.log(`Found ${results.length} Switch 2 Enhanced Editions on IGDB:\n`);

  // Check which ones we have in database
  for (const game of results) {
    // Extract base game name (remove "Nintendo Switch 2 Edition" suffix)
    const baseName = game.name
      .replace(/[:\-–]\s*Nintendo Switch 2 Edition.*$/i, "")
      .replace(/Nintendo Switch 2 Edition.*$/i, "")
      .trim();

    // Check if we have this in database with Switch 2 platform
    const dbGame = await prisma.game.findFirst({
      where: {
        gameFamily: {
          OR: [
            { title: { contains: baseName, mode: "insensitive" } },
            { title: { equals: baseName, mode: "insensitive" } }
          ]
        },
        platform: { slug: "switch-2" }
      },
      include: { gameFamily: true, platform: true }
    });

    if (dbGame) {
      // Check if it has a cover
      if (dbGame.coverUrl) {
        console.log(`✅ ${game.name}`);
        console.log(`   DB: ${dbGame.gameFamily.title} (has cover)`);
      } else {
        console.log(`⚠️  ${game.name}`);
        console.log(`   DB: ${dbGame.gameFamily.title} (MISSING COVER)`);
      }
    } else {
      console.log(`❌ ${game.name}`);
      console.log(`   Not found in database (base: "${baseName}")`);
    }
    console.log();
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
