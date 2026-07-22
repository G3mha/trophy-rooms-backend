/**
 * Import Metroid Prime Remastered for Nintendo Switch (released 2023-02-08).
 *
 * Single-game remaster pattern (same as Switch 2 Enhanced Editions): the
 * remaster joins the existing "Metroid Prime" GameFamily as a Switch Game
 * with the remaster box art as its explicit cover, linked to a shared
 * "Remastered" GameVersion. The family cover stays the GameCube original,
 * which also gets its cover set explicitly.
 */

import { PrismaClient } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

const IGDB_SLUG = "metroid-prime-remastered";
const RELEASE_DATE = new Date("2023-02-08");

async function main() {
  console.log("=== Import Metroid Prime Remastered ===\n");

  const gameFamily = await prisma.gameFamily.findFirst({
    where: { title: { equals: "Metroid Prime", mode: "insensitive" } },
    include: { games: { where: { platform: { slug: "gamecube" } } } },
  });
  if (!gameFamily) {
    console.error("GameFamily 'Metroid Prime' not found");
    return;
  }
  console.log(`Found family: ${gameFamily.title} (${gameFamily.id})`);

  const switchPlatform = await prisma.platform.findUnique({
    where: { slug: "switch" },
  });
  if (!switchPlatform) {
    console.error("Switch platform not found");
    return;
  }

  const existing = await prisma.game.findFirst({
    where: { gameFamilyId: gameFamily.id, platformId: switchPlatform.id },
  });
  if (existing) {
    console.log("Switch game entry already exists:", existing.id);
    return;
  }

  // Fetch remaster metadata (cover, release) from IGDB
  const [igdbGame] = await igdbRequest<IGDBGame[]>(
    "games",
    `fields id, name, slug, summary, cover.image_id, first_release_date;
     where slug = "${IGDB_SLUG}"; limit 1;`
  );
  const remasterCover = igdbGame?.cover?.image_id
    ? getCoverUrl(igdbGame.cover.image_id, "cover_big")
    : null;
  console.log(
    "IGDB:",
    igdbGame ? igdbGame.name : "not found (continuing without cover)"
  );

  // Find or create the shared "Remastered" version
  let remasteredVersion = await prisma.gameVersion.findUnique({
    where: { slug: "remastered" },
  });
  if (!remasteredVersion) {
    remasteredVersion = await prisma.gameVersion.create({
      data: {
        name: "Remastered",
        slug: "remastered",
        isDefault: false,
      },
    });
    console.log(`Created version: ${remasteredVersion.name}`);
  } else {
    console.log(`Found version: ${remasteredVersion.name}`);
  }

  // Create the Switch game with the remaster box art as its explicit cover
  const game = await prisma.game.create({
    data: {
      gameFamilyId: gameFamily.id,
      platformId: switchPlatform.id,
      releaseDate: RELEASE_DATE,
      coverUrl: remasterCover,
      versions: { connect: [{ id: remasteredVersion.id }] },
    },
  });
  console.log(`Created Switch game entry: ${game.id}`);

  // Per the enhanced-edition rules, the original platform game gets its
  // cover set explicitly (same as the family cover) once variants exist
  const gamecubeGame = gameFamily.games[0];
  if (gamecubeGame && !gamecubeGame.coverUrl && gameFamily.coverUrl) {
    await prisma.game.update({
      where: { id: gamecubeGame.id },
      data: { coverUrl: gameFamily.coverUrl },
    });
    console.log("Set explicit cover on the GameCube entry");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
