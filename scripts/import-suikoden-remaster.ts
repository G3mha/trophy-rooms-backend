/**
 * Import Suikoden I & II HD Remaster bundle and its games from IGDB
 */

import { PrismaClient, BundleType } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

async function importGameFamily(searchTerm: string, slugHint: string): Promise<string | null> {
  console.log(`\nSearching for: ${searchTerm}`);

  // Try slug first
  let query = `
    fields id, name, slug, summary, cover.image_id, first_release_date;
    where slug = "${slugHint}";
    limit 1;
  `;

  let results = await igdbRequest<IGDBGame[]>("games", query);

  // If not found by slug, search by name
  if (results.length === 0) {
    query = `
      fields id, name, slug, summary, cover.image_id, first_release_date;
      search "${searchTerm}";
      limit 5;
    `;
    results = await igdbRequest<IGDBGame[]>("games", query);
  }

  if (results.length === 0) {
    console.log(`  Not found on IGDB`);
    return null;
  }

  // Find best match
  const igdbGame = results.find(r => r.slug?.includes("suikoden")) || results[0];

  console.log(`  Found: ${igdbGame.name} (${igdbGame.slug})`);
  console.log(`  IGDB ID: ${igdbGame.id}`);

  // Check if already exists
  const existing = await prisma.gameFamily.findFirst({
    where: {
      OR: [
        { slug: igdbGame.slug },
        { title: { equals: igdbGame.name, mode: "insensitive" } },
      ],
    },
  });

  if (existing) {
    console.log(`  Already exists: ${existing.title}`);
    return existing.id;
  }

  // Create GameFamily
  const gameFamily = await prisma.gameFamily.create({
    data: {
      title: igdbGame.name,
      slug: igdbGame.slug || slugHint,
      description: igdbGame.summary || null,
      coverUrl: igdbGame.cover?.image_id
        ? getCoverUrl(igdbGame.cover.image_id, "cover_big")
        : null,
      releaseDate: igdbGame.first_release_date
        ? new Date(igdbGame.first_release_date * 1000)
        : null,
    },
  });

  console.log(`  Created: ${gameFamily.id}`);
  return gameFamily.id;
}

async function main() {
  console.log("=== Import Suikoden I & II HD Remaster ===\n");

  // First, import the individual games
  const gameIds: string[] = [];

  const suikoden1Id = await importGameFamily("Suikoden", "suikoden");
  if (suikoden1Id) gameIds.push(suikoden1Id);

  await new Promise(resolve => setTimeout(resolve, 250));

  const suikoden2Id = await importGameFamily("Suikoden II", "suikoden-ii");
  if (suikoden2Id) gameIds.push(suikoden2Id);

  await new Promise(resolve => setTimeout(resolve, 250));

  // Now search for the bundle
  console.log("\n--- Searching for HD Remaster Bundle ---");

  const bundleQuery = `
    fields id, name, slug, summary, cover.image_id, first_release_date, platforms.name, platforms.slug;
    search "Suikoden I & II HD Remaster";
    limit 5;
  `;

  const bundleResults = await igdbRequest<IGDBGame[]>("games", bundleQuery);

  console.log("\nSearch results:");
  for (const game of bundleResults) {
    console.log(`  - ${game.name} (${game.slug})`);
  }

  const bundle = bundleResults.find(r =>
    r.slug?.includes("suikoden") && r.slug?.includes("hd-remaster")
  ) || bundleResults[0];

  if (!bundle) {
    console.log("\nBundle not found on IGDB");
    return;
  }

  console.log(`\nFound bundle: ${bundle.name}`);
  console.log(`  IGDB ID: ${bundle.id}`);
  console.log(`  Slug: ${bundle.slug}`);
  if (bundle.platforms) {
    console.log(`  Platforms: ${bundle.platforms.map((p: { name: string }) => p.name).join(", ")}`);
  }

  // Check if bundle already exists
  const existingBundle = await prisma.bundle.findFirst({
    where: {
      OR: [
        { slug: { contains: "suikoden" } },
        { name: { contains: "Suikoden", mode: "insensitive" } },
      ],
    },
  });

  if (existingBundle) {
    console.log(`\nBundle already exists: ${existingBundle.name}`);

    // Update game family links if needed
    if (gameIds.length > 0) {
      await prisma.bundle.update({
        where: { id: existingBundle.id },
        data: {
          gameFamilies: {
            connect: gameIds.map(id => ({ id })),
          },
        },
      });
      console.log(`Updated with ${gameIds.length} games`);
    }
    return;
  }

  // Get platforms
  const platformSlugs = ["switch", "ps5", "ps4", "xbox-series", "xbox-one"];
  const platforms = await prisma.platform.findMany({
    where: { slug: { in: platformSlugs } },
  });

  console.log(`\nFound ${platforms.length} platforms in DB`);

  // Create bundle
  const newBundle = await prisma.bundle.create({
    data: {
      name: bundle.name,
      slug: bundle.slug || "suikoden-i-ii-hd-remaster",
      type: BundleType.COLLECTION,
      description: bundle.summary || null,
      coverUrl: bundle.cover?.image_id
        ? getCoverUrl(bundle.cover.image_id, "cover_big")
        : null,
      releaseDate: bundle.first_release_date
        ? new Date(bundle.first_release_date * 1000)
        : null,
      platforms: {
        connect: platforms.map(p => ({ id: p.id })),
      },
      gameFamilies: gameIds.length > 0 ? {
        connect: gameIds.map(id => ({ id })),
      } : undefined,
    },
  });

  console.log(`\nCreated bundle:`);
  console.log(`  ID: ${newBundle.id}`);
  console.log(`  Name: ${newBundle.name}`);
  console.log(`  Platforms: ${platforms.map(p => p.name).join(", ")}`);
  console.log(`  Games: ${gameIds.length}`);

  // Show final state
  const finalBundle = await prisma.bundle.findUnique({
    where: { id: newBundle.id },
    include: { gameFamilies: true, platforms: true },
  });

  console.log("\nFinal bundle state:");
  console.log(`  Name: ${finalBundle?.name}`);
  console.log(`  Platforms: ${finalBundle?.platforms.map(p => p.name).join(", ")}`);
  if (finalBundle?.gameFamilies) {
    console.log(`  Games:`);
    for (const gf of finalBundle.gameFamilies) {
      console.log(`    - ${gf.title}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
