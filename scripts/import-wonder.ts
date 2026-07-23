import { PrismaClient, GameType } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";
import { normalizeForSearch } from "../src/lib/normalize-search.js";

const prisma = new PrismaClient();

async function main() {
  // Get base game from IGDB
  const baseQuery = `
    fields id, name, slug, summary, cover.image_id, first_release_date, platforms.id, platforms.name;
    where slug = "super-mario-bros-wonder";
    limit 1;
  `;

  const switch2Query = `
    fields id, name, slug, cover.image_id;
    where slug = "super-mario-bros-wonder-nintendo-switch-2-edition-plus-meetup-in-bellabel-park";
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

  // Get standard version
  const standardVersion = await prisma.gameVersion.findFirst({
    where: { slug: "standard" }
  });

  // Create Switch 2 Edition version
  let switch2Edition = await prisma.gameVersion.findFirst({
    where: { slug: "switch-2-edition-wonder-bellabel" }
  });

  if (!switch2Edition) {
    switch2Edition = await prisma.gameVersion.create({
      data: {
        name: "Nintendo Switch 2 Edition + Meetup in Bellabel Park",
        slug: "switch-2-edition-wonder-bellabel",
        isDefault: false
      }
    });
    console.log(`Created version: ${switch2Edition.name}`);
  }

  // Create GameFamily with ORIGINAL cover
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
  console.log(`   Cover (original): ${gameFamily.coverUrl}`);

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
  if (switch2Platform && switch2Game) {
    const switch2Cover = switch2Game.cover?.image_id
      ? getCoverUrl(switch2Game.cover.image_id, "cover_big")
      : null;

    const switch2GameEntry = await prisma.game.create({
      data: {
        gameFamilyId: gameFamily.id,
        platformId: switch2Platform.id,
        coverUrl: switch2Cover,
        releaseDate: new Date("2025-06-05")
      }
    });

    await prisma.$executeRaw`
      INSERT INTO "_GameVersionGames" ("A", "B")
      VALUES (${switch2GameEntry.id}, ${switch2Edition.id})
      ON CONFLICT DO NOTHING
    `;

    console.log(`✅ Created Nintendo Switch 2 entry: ${switch2Edition.name}`);
    console.log(`   Cover (Switch 2): ${switch2Cover}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
