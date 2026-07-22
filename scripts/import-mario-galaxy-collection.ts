/**
 * Import Super Mario Galaxy + Super Mario Galaxy 2 for Nintendo Switch
 * (released 2025-10-02).
 *
 * Compilation pattern: each included game keeps its own GameFamily, the
 * retail product is a Bundle (COLLECTION) connecting both families. Creates
 * the missing Switch Game entries for both families (with the compilation
 * box art as their platform cover, since neither game is sold standalone on
 * Switch) and the Bundle itself.
 */

import { PrismaClient, BundleType } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

const BUNDLE_NAME = "Super Mario Galaxy + Super Mario Galaxy 2";
const BUNDLE_SLUG = "super-mario-galaxy-super-mario-galaxy-2";
const IGDB_SLUG = "super-mario-galaxy-plus-super-mario-galaxy-2";
const RELEASE_DATE = new Date("2025-10-02");
const GAME_TITLES = ["Super Mario Galaxy", "Super Mario Galaxy 2"];

async function main() {
  console.log(`=== Import ${BUNDLE_NAME} ===\n`);

  const gameFamilies = await prisma.gameFamily.findMany({
    where: {
      OR: GAME_TITLES.map((title) => ({
        title: { equals: title, mode: "insensitive" as const },
      })),
    },
  });

  const missing = GAME_TITLES.filter(
    (title) => !gameFamilies.some((gf) => gf.title.toLowerCase() === title.toLowerCase())
  );
  if (missing.length > 0) {
    console.error("Missing game families:", missing.join(", "));
    console.error("Please import these games first.");
    return;
  }
  console.log("Found families:");
  for (const gf of gameFamilies) {
    console.log("  -", gf.title);
  }

  const switchPlatform = await prisma.platform.findUnique({
    where: { slug: "switch" },
  });
  if (!switchPlatform) {
    console.error("Switch platform not found");
    return;
  }

  // Fetch compilation metadata (cover, description) from IGDB.
  // The slug is a best guess, so fall back to a name search.
  const fields = "fields id, name, slug, summary, cover.image_id, first_release_date;";
  let [igdbGame] = await igdbRequest<IGDBGame[]>(
    "games",
    `${fields} where slug = "${IGDB_SLUG}"; limit 1;`
  );
  if (!igdbGame) {
    [igdbGame] = await igdbRequest<IGDBGame[]>(
      "games",
      `${fields} search "${BUNDLE_NAME}"; limit 1;`
    );
  }
  const compilationCover = igdbGame?.cover?.image_id
    ? getCoverUrl(igdbGame.cover.image_id, "cover_big")
    : null;
  console.log(
    "\nIGDB:",
    igdbGame
      ? `${igdbGame.name} (${igdbGame.slug})`
      : "not found (continuing without cover/description)"
  );

  // Neither game is sold standalone on Switch, so both platform Games carry
  // the compilation box art as their cover.
  for (const gameFamily of gameFamilies) {
    const existing = await prisma.game.findFirst({
      where: { gameFamilyId: gameFamily.id, platformId: switchPlatform.id },
    });
    if (existing) {
      console.log(`Switch game entry already exists: ${gameFamily.title}`);
      continue;
    }
    const game = await prisma.game.create({
      data: {
        gameFamilyId: gameFamily.id,
        platformId: switchPlatform.id,
        releaseDate: RELEASE_DATE,
        coverUrl: compilationCover,
      },
    });
    console.log(`Created Switch game for ${gameFamily.title}: ${game.id}`);
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
      name: BUNDLE_NAME,
      slug: BUNDLE_SLUG,
      type: BundleType.COLLECTION,
      description: igdbGame?.summary || null,
      coverUrl: compilationCover,
      releaseDate: RELEASE_DATE,
      platforms: { connect: [{ id: switchPlatform.id }] },
      gameFamilies: {
        connect: gameFamilies.map((gf) => ({ id: gf.id })),
      },
    },
  });

  console.log("\nCreated bundle:");
  console.log("  ID:", bundle.id);
  console.log("  Name:", bundle.name);
  console.log("  Platform:", switchPlatform.name);
  console.log("  Games:", gameFamilies.map((gf) => gf.title).join(", "));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
