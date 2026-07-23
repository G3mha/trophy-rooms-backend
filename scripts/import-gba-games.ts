/**
 * Import missing GBA games from IGDB:
 * - Metroid Zero Mission
 * - Rhythm Tengoku
 * - Kirby: Nightmare in Dream Land
 * - Boktai 3
 */

import { PrismaClient, GameType } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame, PRIMARY_PLATFORM_SLUG_BY_IGDB_ID } from "../src/lib/igdb.js";
import { normalizeForSearch } from "../src/lib/normalize-search.js";

const prisma = new PrismaClient();

const GAMES_TO_IMPORT = [
  { search: "Halloween Ash vs Evil Dead", slug: "halloween-and-ash-vs-evil-dead" },
];

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);
}

async function ensureStandardVersion() {
  let standardVersion = await prisma.gameVersion.findFirst({
    where: { slug: "standard" },
  });

  if (!standardVersion) {
    standardVersion = await prisma.gameVersion.create({
      data: {
        name: "Standard",
        slug: "standard",
        isDefault: true,
      },
    });
  }

  return standardVersion;
}

async function main() {
  console.log("=== Import Missing GBA Games ===\n");

  const standardVersion = await ensureStandardVersion();

  for (const game of GAMES_TO_IMPORT) {
    console.log(`Searching for: ${game.search}`);

    // Try slug first
    let query = `
      fields id, name, slug, summary, cover.image_id, first_release_date, platforms.id, platforms.name;
      where slug = "${game.slug}";
      limit 1;
    `;

    let results = await igdbRequest<IGDBGame[]>("games", query);

    // If not found by slug, search by name
    if (results.length === 0) {
      query = `
        fields id, name, slug, summary, cover.image_id, first_release_date, platforms.id, platforms.name;
        search "${game.search}";
        limit 5;
      `;
      results = await igdbRequest<IGDBGame[]>("games", query);
    }

    if (results.length === 0) {
      console.log(`  ❌ Not found on IGDB\n`);
      continue;
    }

    // Find best match (prefer exact slug match or main game)
    const igdbGame = results.find(r => r.slug === game.slug) || results[0];

    console.log(`  Found: ${igdbGame.name} (${igdbGame.slug})`);
    console.log(`  IGDB ID: ${igdbGame.id}`);
    if (igdbGame.platforms) {
      console.log(`  Platforms: ${igdbGame.platforms.map(p => p.name).join(", ")}`);
    }

    // Check if already exists
    const existing = await prisma.gameFamily.findFirst({
      where: {
        OR: [
          { slug: igdbGame.slug || game.slug },
          { title: { equals: igdbGame.name, mode: "insensitive" } },
        ],
      },
    });

    if (existing) {
      console.log(`  ⚠️ Already exists: ${existing.title} (${existing.id})\n`);
      continue;
    }

    // Create GameFamily
    const gameFamily = await prisma.gameFamily.create({
      data: {
        title: igdbGame.name,
        slug: igdbGame.slug || generateSlug(igdbGame.name),
        searchTitle: normalizeForSearch(igdbGame.name),
        description: igdbGame.summary || null,
        coverUrl: igdbGame.cover?.image_id
          ? getCoverUrl(igdbGame.cover.image_id, "cover_big")
          : null,
        releaseDate: igdbGame.first_release_date
          ? new Date(igdbGame.first_release_date * 1000)
          : null,
        type: GameType.BASE_GAME,
      },
    });

    console.log(`  ✅ Created GameFamily: ${gameFamily.id}`);

    // Map IGDB platforms to Trophy Rooms platforms and create Game entries
    const platformSlugs = Array.from(
      new Set(
        (igdbGame.platforms ?? [])
          .map((p) => PRIMARY_PLATFORM_SLUG_BY_IGDB_ID[p.id])
          .filter((slug): slug is string => Boolean(slug))
      )
    );

    if (platformSlugs.length > 0) {
      const platforms = await prisma.platform.findMany({
        where: { slug: { in: platformSlugs } },
      });

      for (const platform of platforms) {
        const gameEntry = await prisma.game.create({
          data: {
            gameFamilyId: gameFamily.id,
            platformId: platform.id,
            releaseDate: igdbGame.first_release_date
              ? new Date(igdbGame.first_release_date * 1000)
              : null,
          },
        });

        // Link to Standard version
        await prisma.$executeRaw`
          INSERT INTO "_GameVersionGames" ("A", "B")
          VALUES (${gameEntry.id}, ${standardVersion.id})
          ON CONFLICT DO NOTHING
        `;

        console.log(`  ✅ Created Game for ${platform.name}: ${gameEntry.id}`);
      }
    } else {
      console.log(`  ⚠️ No matching platforms found in Trophy Rooms`);
    }

    console.log();

    // Rate limiting delay
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log("=== Import Complete ===");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
