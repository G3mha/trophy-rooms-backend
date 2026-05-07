/**
 * Import missing Castlevania games for the Anniversary Collection
 * and link them to the bundle
 */

import { PrismaClient, GameType } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");

// Missing games with their IGDB slugs and target platforms
const MISSING_GAMES = [
  { slug: "castlevania-iii-dracula-s-curse", platformSlug: "nes" },
  { slug: "super-castlevania-iv", platformSlug: "snes" },
  { slug: "kid-dracula--1", platformSlug: "nes" }, // Famicom/NES version
];

async function main() {
  console.log("=== Import Missing Castlevania Games ===\n");
  console.log("Mode:", DRY_RUN ? "dry-run" : "write");
  console.log("");

  // Get standard version
  const standardVersion = await prisma.gameVersion.findFirst({
    where: { slug: "standard" },
  });

  if (!standardVersion) {
    console.error("Standard version not found");
    return;
  }

  const importedFamilyIds: string[] = [];

  for (const game of MISSING_GAMES) {
    // Fetch from IGDB
    const query = `
      fields id, name, slug, summary, cover.image_id, first_release_date, platforms.id, platforms.name;
      where slug = "${game.slug}";
      limit 1;
    `;

    const [igdbGame] = await igdbRequest<IGDBGame[]>("games", query);

    if (!igdbGame) {
      console.log(`Not found on IGDB: ${game.slug}`);
      continue;
    }

    console.log(`Found: ${igdbGame.name}`);
    console.log(`  IGDB ID: ${igdbGame.id}`);
    console.log(`  Platforms: ${igdbGame.platforms?.map(p => p.name).join(", ")}`);

    // Check if already exists
    const existing = await prisma.gameFamily.findFirst({
      where: { title: { equals: igdbGame.name, mode: "insensitive" } },
    });

    if (existing) {
      console.log(`  Already exists: ${existing.id}`);
      importedFamilyIds.push(existing.id);
      console.log("");
      continue;
    }

    if (DRY_RUN) {
      console.log("  Would import");
      console.log("");
      continue;
    }

    // Get platform
    const platform = await prisma.platform.findUnique({
      where: { slug: game.platformSlug },
    });

    if (!platform) {
      console.log(`  Platform not found: ${game.platformSlug}`);
      continue;
    }

    // Create family and game
    const releaseDate = igdbGame.first_release_date
      ? new Date(igdbGame.first_release_date * 1000)
      : null;

    const coverUrl = igdbGame.cover?.image_id
      ? getCoverUrl(igdbGame.cover.image_id, "cover_big")
      : null;

    const result = await prisma.$transaction(async (tx) => {
      const family = await tx.gameFamily.create({
        data: {
          title: igdbGame.name,
          slug: igdbGame.slug || game.slug,
          description: igdbGame.summary || null,
          coverUrl,
          releaseDate,
          type: GameType.BASE_GAME,
        },
      });

      const gameRecord = await tx.game.create({
        data: {
          gameFamilyId: family.id,
          platformId: platform.id,
          releaseDate,
        },
      });

      await tx.$executeRaw`
        INSERT INTO "_GameVersionGames" ("A", "B")
        VALUES (${gameRecord.id}, ${standardVersion.id})
        ON CONFLICT DO NOTHING
      `;

      return family;
    });

    console.log(`  Imported: ${result.id}`);
    importedFamilyIds.push(result.id);
    console.log("");

    await new Promise(resolve => setTimeout(resolve, 250));
  }

  if (DRY_RUN) {
    console.log("\nDry run complete. Use without --dry-run to import.");
    return;
  }

  // Update Anniversary Collection bundle with new games
  if (importedFamilyIds.length > 0) {
    const bundle = await prisma.bundle.findUnique({
      where: { slug: "castlevania-anniversary-collection" },
    });

    if (bundle) {
      await prisma.bundle.update({
        where: { id: bundle.id },
        data: {
          gameFamilies: {
            connect: importedFamilyIds.map(id => ({ id })),
          },
        },
      });
      console.log(`Updated Anniversary Collection with ${importedFamilyIds.length} games`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
