import { PrismaClient, GameType } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame, PRIMARY_PLATFORM_SLUG_BY_IGDB_ID } from "../src/lib/igdb.js";
import { normalizeForSearch } from "../src/lib/normalize-search.js";

const prisma = new PrismaClient();

async function main() {
  // Search IGDB
  const query = `
    fields id, name, slug, summary, cover.image_id, first_release_date, platforms.id, platforms.name;
    search "New Super Mario Bros U Deluxe";
    limit 5;
  `;

  const results = await igdbRequest<IGDBGame[]>("games", query);

  console.log("IGDB search results:");
  for (const game of results) {
    console.log(`  - ${game.name} (${game.slug})`);
    if (game.platforms) {
      console.log(`    Platforms: ${game.platforms.map(p => p.name).join(", ")}`);
    }
  }

  // Find the Deluxe version
  const igdbGame = results.find(r => r.slug === "new-super-mario-bros-u-deluxe") || results[0];

  if (!igdbGame) {
    console.log("\nGame not found on IGDB");
    return;
  }

  console.log(`\nImporting: ${igdbGame.name}`);

  // Check if already exists
  const existing = await prisma.gameFamily.findFirst({
    where: {
      OR: [
        { slug: igdbGame.slug },
        { title: { equals: igdbGame.name, mode: "insensitive" } }
      ]
    }
  });

  if (existing) {
    console.log(`Already exists: ${existing.title} (${existing.id})`);
    return;
  }

  const coverUrl = igdbGame.cover?.image_id
    ? getCoverUrl(igdbGame.cover.image_id, "cover_big")
    : null;

  // Create GameFamily
  const gameFamily = await prisma.gameFamily.create({
    data: {
      title: igdbGame.name,
      slug: igdbGame.slug || igdbGame.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      searchTitle: normalizeForSearch(igdbGame.name),
      description: igdbGame.summary || null,
      coverUrl,
      releaseDate: igdbGame.first_release_date
        ? new Date(igdbGame.first_release_date * 1000)
        : null,
      type: GameType.BASE_GAME
    }
  });

  console.log(`✅ Created GameFamily: ${gameFamily.title}`);
  console.log(`   Cover: ${coverUrl}`);

  // Get standard version
  const standardVersion = await prisma.gameVersion.findFirst({
    where: { slug: "standard" }
  });

  // Map platforms and create Game entries
  const platformSlugs = (igdbGame.platforms ?? [])
    .map(p => PRIMARY_PLATFORM_SLUG_BY_IGDB_ID[p.id])
    .filter((slug): slug is string => Boolean(slug));

  const platforms = await prisma.platform.findMany({
    where: { slug: { in: platformSlugs } }
  });

  for (const platform of platforms) {
    const game = await prisma.game.create({
      data: {
        gameFamilyId: gameFamily.id,
        platformId: platform.id,
        coverUrl, // Explicit cover
        releaseDate: igdbGame.first_release_date
          ? new Date(igdbGame.first_release_date * 1000)
          : null
      }
    });

    if (standardVersion) {
      await prisma.$executeRaw`
        INSERT INTO "_GameVersionGames" ("A", "B")
        VALUES (${game.id}, ${standardVersion.id})
        ON CONFLICT DO NOTHING
      `;
    }

    console.log(`✅ Created ${platform.name} entry`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
