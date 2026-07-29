/**
 * The seeded "Final Fantasy III" family is actually Final Fantasy VI under
 * its 1994 North American marketing title (SNES + VC entries). Rename it to
 * the canonical Final Fantasy VI, then create the real Final Fantasy III:
 * the 1990 Famicom original (JP) plus the 2006 DS 3D remake (NA
 * 2006-11-14) as a Remake version with the DS box art as its platform
 * cover.
 */

import { PrismaClient } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";
import { normalizeForSearch } from "../src/lib/normalize-search.js";

const prisma = new PrismaClient();

async function igdbBySlug(slug: string): Promise<IGDBGame | null> {
  try {
    const [game] = await igdbRequest<IGDBGame[]>(
      "games",
      `fields id, name, slug, summary, cover.image_id, first_release_date;
       where slug = "${slug}"; limit 1;`
    );
    return game ?? null;
  } catch {
    return null;
  }
}

function coverOf(game: IGDBGame | null): string | null {
  return game?.cover?.image_id ? getCoverUrl(game.cover.image_id, "cover_big") : null;
}

async function main() {
  console.log("=== Fix Final Fantasy III / VI ===\n");

  // 1. Rename the mislabeled family to Final Fantasy VI
  const misnamed = await prisma.gameFamily.findFirst({
    where: { title: { equals: "Final Fantasy III", mode: "insensitive" } },
    include: { games: { include: { platform: true } } },
  });
  if (misnamed && misnamed.games.some((g) => g.platform?.slug === "snes")) {
    const vi = await igdbBySlug("final-fantasy-vi");
    await prisma.gameFamily.update({
      where: { id: misnamed.id },
      data: {
        title: "Final Fantasy VI",
        slug: "final-fantasy-vi",
        searchTitle: normalizeForSearch("Final Fantasy VI"),
        description: vi?.summary ?? misnamed.description,
        coverUrl: coverOf(vi) ?? misnamed.coverUrl,
      },
    });
    console.log("Renamed to Final Fantasy VI (was NA-titled Final Fantasy III)");
  } else {
    console.log("Mislabeled family not found or already renamed");
  }

  // 2. Create the real Final Fantasy III
  const existing = await prisma.gameFamily.findFirst({
    where: { slug: "final-fantasy-iii" },
  });
  if (existing) {
    console.log("Final Fantasy III already exists");
    return;
  }

  const original = await igdbBySlug("final-fantasy-iii");
  const family = await prisma.gameFamily.create({
    data: {
      title: "Final Fantasy III",
      slug: "final-fantasy-iii",
      searchTitle: normalizeForSearch("Final Fantasy III"),
      description: original?.summary || null,
      coverUrl: coverOf(original),
      releaseDate: new Date("1990-04-27"),
    },
  });
  console.log("Created family: Final Fantasy III");

  const standard = await prisma.gameVersion.findUnique({ where: { slug: "standard" } });
  const remake = await prisma.gameVersion.findUnique({ where: { slug: "remake" } });

  const nes = await prisma.platform.findUnique({ where: { slug: "nes" } });
  if (nes) {
    await prisma.game.create({
      data: {
        gameFamilyId: family.id,
        platformId: nes.id,
        releaseDate: new Date("1990-04-27"),
        ...(standard ? { versions: { connect: [{ id: standard.id }] } } : {}),
      },
    });
    console.log("Famicom original created (JP 1990-04-27)");
  }

  const dsRemake =
    (await igdbBySlug("final-fantasy-iii-3d-remake")) ??
    (await igdbBySlug("final-fantasy-iii--1"));
  const nds = await prisma.platform.findUnique({ where: { slug: "nds" } });
  if (nds) {
    const game = await prisma.game.create({
      data: {
        gameFamilyId: family.id,
        platformId: nds.id,
        releaseDate: new Date("2006-11-14"),
        coverUrl: coverOf(dsRemake),
        ...(remake ? { versions: { connect: [{ id: remake.id }] } } : {}),
      },
    });
    if (remake) {
      await prisma.gameVersionReleaseDate.upsert({
        where: { gameId_gameVersionId: { gameId: game.id, gameVersionId: remake.id } },
        update: { releaseDate: new Date("2006-11-14") },
        create: { gameId: game.id, gameVersionId: remake.id, releaseDate: new Date("2006-11-14") },
      });
    }
    console.log(`DS 3D remake created (NA 2006-11-14)${dsRemake ? " with DS box art" : ""}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
