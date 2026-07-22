/**
 * Import Super Mario 3D World + Bowser's Fury for Nintendo Switch
 *
 * Compilation pattern: each included game keeps its own GameFamily, the
 * retail product is a Bundle (COLLECTION) connecting both families.
 * Creates the missing "Super Mario 3D World" Switch Game entry (with the
 * compilation box art as its platform cover, since the game is only sold
 * as part of the compilation on Switch) and the Bundle itself.
 */

import { PrismaClient, BundleType } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

const BUNDLE_SLUG = "super-mario-3d-world-bowsers-fury";
const IGDB_SLUG = "super-mario-3d-world-plus-bowsers-fury";
const RELEASE_DATE = new Date("2021-02-12");

async function main() {
  console.log("=== Import Super Mario 3D World + Bowser's Fury ===\n");

  const mario3dWorld = await prisma.gameFamily.findFirst({
    where: { title: { equals: "Super Mario 3D World", mode: "insensitive" } },
  });
  const bowsersFury = await prisma.gameFamily.findFirst({
    where: { title: { equals: "Bowser's Fury", mode: "insensitive" } },
  });

  if (!mario3dWorld || !bowsersFury) {
    console.error(
      "GameFamily not found:",
      !mario3dWorld ? "Super Mario 3D World" : "Bowser's Fury"
    );
    return;
  }
  console.log("Found families:");
  console.log("  -", mario3dWorld.title);
  console.log("  -", bowsersFury.title);

  const switchPlatform = await prisma.platform.findUnique({
    where: { slug: "switch" },
  });
  if (!switchPlatform) {
    console.error("Switch platform not found");
    return;
  }

  // Fetch compilation metadata (cover, description) from IGDB
  const query = `
    fields id, name, slug, summary, cover.image_id, first_release_date;
    where slug = "${IGDB_SLUG}";
    limit 1;
  `;
  const [igdbGame] = await igdbRequest<IGDBGame[]>("games", query);
  const compilationCover = igdbGame?.cover?.image_id
    ? getCoverUrl(igdbGame.cover.image_id, "cover_big")
    : null;
  console.log(
    "\nIGDB:",
    igdbGame ? igdbGame.name : "not found (continuing without cover/description)"
  );

  let switchGame = await prisma.game.findFirst({
    where: { gameFamilyId: mario3dWorld.id, platformId: switchPlatform.id },
  });
  if (switchGame) {
    console.log("\nSwitch game entry already exists:", switchGame.id);
  } else {
    switchGame = await prisma.game.create({
      data: {
        gameFamilyId: mario3dWorld.id,
        platformId: switchPlatform.id,
        releaseDate: RELEASE_DATE,
        coverUrl: compilationCover,
      },
    });
    console.log("\nCreated Super Mario 3D World Switch game:", switchGame.id);
  }

  const existingBundle = await prisma.bundle.findUnique({
    where: { slug: BUNDLE_SLUG },
  });
  if (existingBundle) {
    console.log("Bundle already exists:", existingBundle.id);
    return;
  }

  const bundle = await prisma.bundle.create({
    data: {
      name: "Super Mario 3D World + Bowser's Fury",
      slug: BUNDLE_SLUG,
      type: BundleType.COLLECTION,
      description: igdbGame?.summary || null,
      coverUrl: compilationCover,
      releaseDate: RELEASE_DATE,
      platforms: { connect: [{ id: switchPlatform.id }] },
      gameFamilies: {
        connect: [{ id: mario3dWorld.id }, { id: bowsersFury.id }],
      },
    },
  });

  console.log("\nCreated bundle:");
  console.log("  ID:", bundle.id);
  console.log("  Name:", bundle.name);
  console.log("  Platform:", switchPlatform.name);
  console.log("  Games: Super Mario 3D World, Bowser's Fury");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
