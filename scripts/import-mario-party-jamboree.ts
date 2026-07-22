import { PrismaClient, GameType } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";
import { normalizeForSearch } from "../src/lib/normalize-search.js";

const prisma = new PrismaClient();

async function main() {
  // Search for both versions
  const baseQuery = `
    fields id, name, slug, summary, cover.image_id, first_release_date, platforms.id, platforms.name;
    where slug = "super-mario-party-jamboree";
    limit 1;
  `;

  const switch2Query = `
    fields id, name, slug, cover.image_id;
    where slug = "super-mario-party-jamboree-nintendo-switch-2-edition-plus-jamboree-tv";
    limit 1;
  `;

  const [baseResults, switch2Results] = await Promise.all([
    igdbRequest<IGDBGame[]>("games", baseQuery),
    igdbRequest<IGDBGame[]>("games", switch2Query)
  ]);

  const baseGame = baseResults[0];
  const switch2Game = switch2Results[0];

  if (!baseGame) {
    console.log("Base game not found on IGDB");
    return;
  }

  console.log(`Found: ${baseGame.name}`);
  console.log(`Switch 2 Edition: ${switch2Game?.name || "Not found"}`);

  // Get platforms
  const [switchPlatform, switch2Platform] = await Promise.all([
    prisma.platform.findFirst({ where: { slug: "switch" } }),
    prisma.platform.findFirst({ where: { slug: "switch-2" } })
  ]);

  // Get or create standard version
  const standardVersion = await prisma.gameVersion.findFirst({
    where: { slug: "standard" }
  });

  // Get or create Switch 2 Edition version
  let switch2Edition = await prisma.gameVersion.findFirst({
    where: { slug: "switch-2-edition-jamboree-tv" }
  });

  if (!switch2Edition) {
    switch2Edition = await prisma.gameVersion.create({
      data: {
        name: "Nintendo Switch 2 Edition + Jamboree TV",
        slug: "switch-2-edition-jamboree-tv",
        isDefault: false
      }
    });
    console.log(`Created version: ${switch2Edition.name}`);
  }

  // Create GameFamily
  const gameFamily = await prisma.gameFamily.create({
    data: {
      title: baseGame.name,
      slug: baseGame.slug,
      searchTitle: normalizeForSearch(baseGame.name),
      description: baseGame.summary || null,
      coverUrl: baseGame.cover?.image_id
        ? getCoverUrl(baseGame.cover.image_id, "cover_big")
        : null,
      releaseDate: baseGame.first_release_date
        ? new Date(baseGame.first_release_date * 1000)
        : null,
      type: GameType.BASE_GAME
    }
  });

  console.log(`✅ Created GameFamily: ${gameFamily.title}`);

  // Create Switch game entry
  if (switchPlatform) {
    const switchGame = await prisma.game.create({
      data: {
        gameFamilyId: gameFamily.id,
        platformId: switchPlatform.id,
        releaseDate: baseGame.first_release_date
          ? new Date(baseGame.first_release_date * 1000)
          : null
      }
    });

    if (standardVersion) {
      await prisma.$executeRaw`
        INSERT INTO "_GameVersionGames" ("A", "B")
        VALUES (${switchGame.id}, ${standardVersion.id})
        ON CONFLICT DO NOTHING
      `;
    }

    console.log(`✅ Created Nintendo Switch entry: Standard`);
  }

  // Create Switch 2 game entry with specific cover
  if (switch2Platform) {
    const switch2GameEntry = await prisma.game.create({
      data: {
        gameFamilyId: gameFamily.id,
        platformId: switch2Platform.id,
        coverUrl: switch2Game?.cover?.image_id
          ? getCoverUrl(switch2Game.cover.image_id, "cover_big")
          : null,
        releaseDate: new Date("2025-06-05") // Switch 2 launch
      }
    });

    await prisma.$executeRaw`
      INSERT INTO "_GameVersionGames" ("A", "B")
      VALUES (${switch2GameEntry.id}, ${switch2Edition.id})
      ON CONFLICT DO NOTHING
    `;

    console.log(`✅ Created Nintendo Switch 2 entry: ${switch2Edition.name}`);
    if (switch2Game?.cover?.image_id) {
      console.log(`   Cover: ${getCoverUrl(switch2Game.cover.image_id, "cover_big")}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
