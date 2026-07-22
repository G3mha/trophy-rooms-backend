/**
 * Import Lunar Remastered Collection as a Bundle from IGDB
 */

import { PrismaClient, BundleType } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Import Lunar Remastered Collection ===\n");

  // Search for the collection on IGDB
  const searchQuery = `
    fields id, name, slug, summary, cover.image_id, first_release_date, platforms.name, platforms.slug;
    search "Lunar Remastered Collection";
    limit 10;
  `;

  console.log("Searching IGDB...\n");
  const searchResults = await igdbRequest<IGDBGame[]>("games", searchQuery);

  for (const game of searchResults) {
    console.log(`- ${game.name} (${game.slug})`);
    console.log(`  ID: ${game.id}`);
    if (game.platforms) {
      console.log(`  Platforms: ${game.platforms.map((p: { name: string }) => p.name).join(", ")}`);
    }
    console.log("");
  }

  // Find the exact match
  const lunar = searchResults.find(g => g.slug === "lunar-remastered-collection");

  if (!lunar) {
    console.log("Lunar Remastered Collection not found on IGDB");
    console.log("\nTrying alternative search...");

    const altQuery = `
      fields id, name, slug, summary, cover.image_id, first_release_date, platforms.name, platforms.slug;
      where name ~ *"Lunar"* & name ~ *"Remastered"*;
      limit 10;
    `;

    const altResults = await igdbRequest<IGDBGame[]>("games", altQuery);
    for (const game of altResults) {
      console.log(`- ${game.name} (${game.slug})`);
    }
    return;
  }

  console.log(`\nFound: ${lunar.name}`);
  console.log(`  IGDB ID: ${lunar.id}`);
  console.log(`  Slug: ${lunar.slug}`);
  console.log(`  Release: ${lunar.first_release_date ? new Date(lunar.first_release_date * 1000).toISOString().split("T")[0] : "N/A"}`);

  // Check if bundle already exists
  const existing = await prisma.bundle.findFirst({
    where: { slug: { contains: "lunar-remastered" } },
  });

  if (existing) {
    console.log(`\nBundle already exists: ${existing.id}`);
    return;
  }

  // Get platforms
  const platformSlugs = ["switch", "ps5", "ps4", "xbox-series", "xbox-one"];
  const platforms = await prisma.platform.findMany({
    where: { slug: { in: platformSlugs } },
  });

  console.log(`\nFound ${platforms.length} platforms in DB`);

  // Check for the games in the collection
  // Lunar: Silver Star Story and Lunar 2: Eternal Blue
  const gameTitles = [
    "Lunar: Silver Star Story Complete",
    "Lunar 2: Eternal Blue Complete",
    "Lunar: Silver Star Story",
    "Lunar 2: Eternal Blue",
  ];

  const gameFamilies = await prisma.gameFamily.findMany({
    where: {
      OR: gameTitles.map(title => ({
        title: { contains: title.split(":")[0], mode: "insensitive" as const },
      })),
    },
  });

  console.log(`Found ${gameFamilies.length} game families:`);
  for (const gf of gameFamilies) {
    console.log(`  - ${gf.title}`);
  }

  // Create bundle
  const bundle = await prisma.bundle.create({
    data: {
      name: lunar.name,
      slug: "lunar-remastered-collection",
      type: BundleType.COLLECTION,
      description: lunar.summary || null,
      coverUrl: lunar.cover?.image_id
        ? getCoverUrl(lunar.cover.image_id, "cover_big")
        : null,
      releaseDate: lunar.first_release_date
        ? new Date(lunar.first_release_date * 1000)
        : null,
      platforms: {
        connect: platforms.map(p => ({ id: p.id })),
      },
      gameFamilies: gameFamilies.length > 0 ? {
        connect: gameFamilies.map(gf => ({ id: gf.id })),
      } : undefined,
    },
  });

  console.log(`\nCreated bundle:`);
  console.log(`  ID: ${bundle.id}`);
  console.log(`  Name: ${bundle.name}`);
  console.log(`  Platforms: ${platforms.map(p => p.name).join(", ")}`);
  console.log(`  Games: ${gameFamilies.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
