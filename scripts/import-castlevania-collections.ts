/**
 * Import Castlevania Collections as Bundles from IGDB
 * These are compilation releases linking to existing game families
 */

import { PrismaClient, BundleType } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");

// Collection definitions with their game family titles and platforms
const COLLECTIONS = [
  {
    slug: "castlevania-anniversary-collection",
    platformSlugs: ["switch", "ps4", "xbox-one"],
    gameTitles: [
      "Castlevania",
      "Castlevania II: Simon's Quest",
      "Castlevania III: Dracula's Curse",
      "Super Castlevania IV",
      "Castlevania: The Adventure",
      "Castlevania II: Belmont's Revenge",
      "Castlevania: Bloodlines",
      "Kid Dracula",
    ],
  },
  {
    slug: "castlevania-advance-collection",
    platformSlugs: ["switch", "ps4", "xbox-one"],
    gameTitles: [
      "Castlevania: Circle of the Moon",
      "Castlevania: Harmony of Dissonance",
      "Castlevania: Aria of Sorrow",
      "Castlevania: Rondo of Blood", // Dracula X
    ],
  },
  {
    slug: "castlevania-dominus-collection",
    platformSlugs: ["switch", "ps5", "xbox-series"], // No PS4 - next-gen only
    gameTitles: [
      "Castlevania: Dawn of Sorrow",
      "Castlevania: Portrait of Ruin",
      "Castlevania: Order of Ecclesia",
    ],
  },
];

async function main() {
  console.log("=== Import Castlevania Collections as Bundles ===\n");
  console.log("Mode:", DRY_RUN ? "dry-run" : "write");
  console.log("");

  console.log("Fetching collection metadata from IGDB...\n");

  for (const collection of COLLECTIONS) {
    // Fetch from IGDB
    const query = `
      fields id, name, slug, summary, cover.image_id, first_release_date;
      where slug = "${collection.slug}";
      limit 1;
    `;

    const [igdbGame] = await igdbRequest<IGDBGame[]>("games", query);

    if (!igdbGame) {
      console.log(`Not found on IGDB: ${collection.slug}`);
      continue;
    }

    console.log(`${igdbGame.name}`);
    console.log(`  IGDB ID: ${igdbGame.id}`);
    console.log(`  Release: ${igdbGame.first_release_date ? new Date(igdbGame.first_release_date * 1000).toISOString().split("T")[0] : "N/A"}`);
    console.log(`  Platforms: ${collection.platformSlugs.join(", ")}`);

    // Find existing game families
    const gameFamilies = await prisma.gameFamily.findMany({
      where: {
        OR: collection.gameTitles.map(title => ({
          title: { equals: title, mode: "insensitive" as const },
        })),
      },
    });

    console.log(`  Found ${gameFamilies.length}/${collection.gameTitles.length} games in DB`);

    const missing = collection.gameTitles.filter(
      title => !gameFamilies.some(gf => gf.title.toLowerCase() === title.toLowerCase())
    );
    if (missing.length > 0) {
      console.log(`  Missing: ${missing.join(", ")}`);
    }

    if (DRY_RUN) {
      console.log("");
      continue;
    }

    // Create bundle for each platform
    for (const platformSlug of collection.platformSlugs) {
      const platform = await prisma.platform.findUnique({
        where: { slug: platformSlug },
      });

      if (!platform) {
        console.log(`  Platform not found: ${platformSlug}`);
        continue;
      }

      // Use platform-specific slug for non-primary platforms
      const bundleSlug = platformSlug === "switch"
        ? collection.slug
        : `${collection.slug}-${platformSlug}`;

      // Check if bundle already exists
      const existing = await prisma.bundle.findUnique({
        where: { slug: bundleSlug },
      });

      if (existing) {
        console.log(`  Already exists (${platform.name}): ${existing.id}`);
        continue;
      }

      const releaseDate = igdbGame.first_release_date
        ? new Date(igdbGame.first_release_date * 1000)
        : null;

      const coverUrl = igdbGame.cover?.image_id
        ? getCoverUrl(igdbGame.cover.image_id, "cover_big")
        : null;

      const bundle = await prisma.bundle.create({
        data: {
          name: igdbGame.name,
          slug: bundleSlug,
          type: BundleType.COLLECTION,
          description: igdbGame.summary || null,
          coverUrl,
          releaseDate,
          platformId: platform.id,
          gameFamilies: {
            connect: gameFamilies.map(gf => ({ id: gf.id })),
          },
        },
      });

      console.log(`  Created (${platform.name}): ${bundle.id}`);
    }

    console.log("");
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  if (DRY_RUN) {
    console.log("\nDry run complete. Use without --dry-run to import.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
