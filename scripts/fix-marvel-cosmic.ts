import { PrismaClient } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame, PRIMARY_PLATFORM_SLUG_BY_IGDB_ID } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

async function main() {
  // Get full game info from IGDB
  const query = `
    fields id, name, slug, summary, cover.image_id, first_release_date, platforms.id, platforms.name;
    where slug = "marvel-cosmic-invasion";
    limit 1;
  `;

  const results = await igdbRequest<IGDBGame[]>("games", query);
  const igdbGame = results[0];

  if (!igdbGame) {
    console.log("Game not found on IGDB");
    return;
  }

  console.log(`IGDB: ${igdbGame.name}`);
  console.log(`Platforms: ${igdbGame.platforms?.map(p => p.name).join(", ")}`);

  const coverUrl = igdbGame.cover?.image_id
    ? getCoverUrl(igdbGame.cover.image_id, "cover_big")
    : null;

  // Get GameFamily
  const gameFamily = await prisma.gameFamily.findFirst({
    where: { title: { contains: "Marvel Cosmic", mode: "insensitive" } },
    include: {
      games: { include: { platform: true } }
    }
  });

  if (!gameFamily) {
    console.log("GameFamily not found in database");
    return;
  }

  console.log(`\nDB GameFamily: ${gameFamily.title}`);

  // Get standard version
  const standardVersion = await prisma.gameVersion.findFirst({
    where: { slug: "standard" }
  });

  // Map IGDB platforms to our platform slugs
  const platformSlugs = (igdbGame.platforms ?? [])
    .map(p => PRIMARY_PLATFORM_SLUG_BY_IGDB_ID[p.id])
    .filter((slug): slug is string => Boolean(slug));

  console.log(`\nMapped platform slugs: ${platformSlugs.join(", ")}`);

  // Get all platforms from DB
  const platforms = await prisma.platform.findMany({
    where: { slug: { in: platformSlugs } }
  });

  console.log(`Found ${platforms.length} platforms in DB`);

  // Check existing platforms
  const existingPlatformIds = gameFamily.games.map(g => g.platformId);

  for (const platform of platforms) {
    const exists = existingPlatformIds.includes(platform.id);

    if (exists) {
      // Update existing entry with cover
      const game = gameFamily.games.find(g => g.platformId === platform.id);
      if (game && !game.coverUrl && coverUrl) {
        await prisma.game.update({
          where: { id: game.id },
          data: { coverUrl }
        });
        console.log(`✅ Updated ${platform.name} with cover`);
      } else {
        console.log(`⏭️  ${platform.name} already exists`);
      }
    } else {
      // Create new entry
      const newGame = await prisma.game.create({
        data: {
          gameFamilyId: gameFamily.id,
          platformId: platform.id,
          coverUrl,
          releaseDate: igdbGame.first_release_date
            ? new Date(igdbGame.first_release_date * 1000)
            : null
        }
      });

      if (standardVersion) {
        await prisma.$executeRaw`
          INSERT INTO "_GameVersionGames" ("A", "B")
          VALUES (${newGame.id}, ${standardVersion.id})
          ON CONFLICT DO NOTHING
        `;
      }

      console.log(`✅ Created ${platform.name} entry`);
    }
  }

  // Final check
  const updated = await prisma.gameFamily.findFirst({
    where: { id: gameFamily.id },
    include: {
      games: { include: { platform: true } }
    }
  });

  console.log(`\n=== Final State ===`);
  console.log(`${updated?.title}`);
  for (const g of updated?.games ?? []) {
    console.log(`  - ${g.platform?.name}: ${g.coverUrl ? "✅ has cover" : "❌ no cover"}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
