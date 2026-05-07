/**
 * Import Castlevania Requiem collection for PS4
 * Contains: Symphony of the Night + Rondo of Blood
 */

import { PrismaClient, BundleType } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Import Castlevania Requiem ===\n");

  // Games in Requiem
  const gameTitles = [
    "Castlevania: Symphony of the Night",
    "Castlevania: Rondo of Blood",
  ];

  // Check for existing games
  const gameFamilies = await prisma.gameFamily.findMany({
    where: {
      OR: gameTitles.map(title => ({
        title: { equals: title, mode: "insensitive" as const },
      })),
    },
  });

  console.log("Found games:");
  for (const gf of gameFamilies) {
    console.log("  -", gf.title);
  }

  const missing = gameTitles.filter(
    title => !gameFamilies.some(gf => gf.title.toLowerCase() === title.toLowerCase())
  );

  if (missing.length > 0) {
    console.log("\nMissing games:", missing.join(", "));
    console.log("Please import these games first.");
    return;
  }

  // Get PS4 platform
  const ps4 = await prisma.platform.findUnique({ where: { slug: "ps4" } });
  if (!ps4) {
    console.error("PS4 platform not found");
    return;
  }

  // Check if bundle already exists
  const existing = await prisma.bundle.findFirst({
    where: { slug: { contains: "castlevania-requiem" } },
  });

  if (existing) {
    console.log("\nBundle already exists:", existing.id);
    return;
  }

  // Fetch from IGDB
  const query = `
    fields id, name, slug, summary, cover.image_id, first_release_date;
    where slug = "castlevania-requiem-symphony-of-the-night-and-rondo-of-blood";
    limit 1;
  `;

  const [igdbGame] = await igdbRequest<IGDBGame[]>("games", query);

  if (!igdbGame) {
    console.error("Not found on IGDB");
    return;
  }

  console.log("\nIGDB data:");
  console.log("  Name:", igdbGame.name);
  console.log("  Release:", igdbGame.first_release_date
    ? new Date(igdbGame.first_release_date * 1000).toISOString().split("T")[0]
    : "N/A");

  // Create bundle
  const bundle = await prisma.bundle.create({
    data: {
      name: igdbGame.name,
      slug: "castlevania-requiem",
      type: BundleType.COLLECTION,
      description: igdbGame.summary || null,
      coverUrl: igdbGame.cover?.image_id
        ? getCoverUrl(igdbGame.cover.image_id, "cover_big")
        : null,
      releaseDate: igdbGame.first_release_date
        ? new Date(igdbGame.first_release_date * 1000)
        : null,
      platformId: ps4.id,
      gameFamilies: {
        connect: gameFamilies.map(gf => ({ id: gf.id })),
      },
    },
  });

  console.log("\nCreated bundle:");
  console.log("  ID:", bundle.id);
  console.log("  Name:", bundle.name);
  console.log("  Platform: PS4");
  console.log("  Games:", gameFamilies.length);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
