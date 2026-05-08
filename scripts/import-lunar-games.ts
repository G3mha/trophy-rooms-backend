/**
 * Import Lunar games (Silver Star Story and Eternal Blue) as GameFamilies
 */

import { PrismaClient } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

const LUNAR_GAMES = [
  { search: "Lunar: Silver Star Story Complete", slug: "lunar-silver-star-story-complete" },
  { search: "Lunar 2: Eternal Blue Complete", slug: "lunar-2-eternal-blue-complete" },
  { search: "Lunar: Silver Star Story", slug: "lunar-silver-star-story" },
  { search: "Lunar 2: Eternal Blue", slug: "lunar-2-eternal-blue" },
];

async function main() {
  console.log("=== Import Lunar Games ===\n");

  const createdFamilies: string[] = [];

  for (const game of LUNAR_GAMES) {
    console.log(`Searching for: ${game.search}`);

    // Try slug first
    let query = `
      fields id, name, slug, summary, cover.image_id, first_release_date, genres.name;
      where slug = "${game.slug}";
      limit 1;
    `;

    let results = await igdbRequest<IGDBGame[]>("games", query);

    // If not found by slug, search by name
    if (results.length === 0) {
      query = `
        fields id, name, slug, summary, cover.image_id, first_release_date, genres.name;
        search "${game.search}";
        limit 5;
      `;
      results = await igdbRequest<IGDBGame[]>("games", query);
    }

    if (results.length === 0) {
      console.log(`  Not found on IGDB\n`);
      continue;
    }

    // Find best match
    const igdbGame = results.find(r =>
      r.slug?.includes("lunar") &&
      (r.slug?.includes("silver-star") || r.slug?.includes("eternal-blue"))
    ) || results[0];

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
      console.log(`  Already exists: ${existing.title}\n`);
      createdFamilies.push(existing.id);
      continue;
    }

    // Create GameFamily
    const gameFamily = await prisma.gameFamily.create({
      data: {
        title: igdbGame.name,
        slug: igdbGame.slug || game.slug,
        description: igdbGame.summary || null,
        coverUrl: igdbGame.cover?.image_id
          ? getCoverUrl(igdbGame.cover.image_id, "cover_big")
          : null,
        releaseDate: igdbGame.first_release_date
          ? new Date(igdbGame.first_release_date * 1000)
          : null,
      },
    });

    console.log(`  Created: ${gameFamily.id}\n`);
    createdFamilies.push(gameFamily.id);

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  // Link to bundle
  if (createdFamilies.length > 0) {
    // Get unique IDs
    const uniqueIds = [...new Set(createdFamilies)];

    const bundle = await prisma.bundle.findUnique({
      where: { slug: "lunar-remastered-collection" },
    });

    if (bundle) {
      await prisma.bundle.update({
        where: { id: bundle.id },
        data: {
          gameFamilies: {
            connect: uniqueIds.map(id => ({ id })),
          },
        },
      });
      console.log(`Linked ${uniqueIds.length} games to Lunar Remastered Collection`);
    }
  }

  // Show final state
  const bundle = await prisma.bundle.findUnique({
    where: { slug: "lunar-remastered-collection" },
    include: { gameFamilies: true, platforms: true },
  });

  console.log("\nFinal bundle state:");
  console.log("  Name:", bundle?.name);
  console.log("  Platforms:", bundle?.platforms.map(p => p.name).join(", "));
  console.log("  Games:", bundle?.gameFamilies.length || 0);
  if (bundle?.gameFamilies) {
    for (const gf of bundle.gameFamilies) {
      console.log("    -", gf.title);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
