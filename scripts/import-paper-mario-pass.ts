/**
 * Paper Mario series pass (2026-07-22).
 *
 * - Create Paper Mario: Color Splash (Wii U 2016-10-07, missing entirely)
 * - The Thousand-Year Door: add the Switch remake (2024-05-23) as a
 *   "Remake" version in the same family (identical title, Live A Live
 *   precedent)
 * - Fix Virtual Console dates carrying original release dates:
 *   Paper Mario Wii VC 2007-04-16, Wii U VC 2015-04-30;
 *   Super Paper Mario Wii U eShop 2016-06-16
 */

import { PrismaClient } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";
import { normalizeForSearch } from "../src/lib/normalize-search.js";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Paper Mario series pass ===\n");

  const standard = await prisma.gameVersion.findUnique({ where: { slug: "standard" } });
  const remakeVersion = await prisma.gameVersion.findUnique({ where: { slug: "remake" } });
  if (!standard || !remakeVersion) {
    console.error("Standard or Remake version missing");
    return;
  }

  // --- VC / eShop date fixes ---
  const dateFixes: Array<[string, string, string]> = [
    ["Paper Mario", "wii", "2007-04-16"],
    ["Paper Mario", "wii-u", "2015-04-30"],
    ["Super Paper Mario", "wii-u", "2016-06-16"],
  ];
  for (const [title, slug, date] of dateFixes) {
    const game = await prisma.game.findFirst({
      where: {
        gameFamily: { title: { equals: title, mode: "insensitive" } },
        platform: { slug },
      },
    });
    if (game && game.releaseDate?.getTime() !== new Date(date).getTime()) {
      await prisma.game.update({
        where: { id: game.id },
        data: { releaseDate: new Date(date) },
      });
      console.log(`${title} ${slug}: date -> ${date}`);
    }
  }

  // --- TTYD Switch remake (same title -> same family + Remake version) ---
  const ttyd = await prisma.gameFamily.findFirst({
    where: { title: { equals: "Paper Mario: The Thousand-Year Door", mode: "insensitive" } },
    include: { games: { include: { platform: true } } },
  });
  if (ttyd && !ttyd.games.some((g) => g.platform?.slug === "switch")) {
    const results = await igdbRequest<IGDBGame[]>(
      "games",
      `fields id, name, slug, summary, cover.image_id, first_release_date;
       where name = "Paper Mario: The Thousand-Year Door"; limit 10;`
    );
    const remakeIgdb = results.find(
      (g) => g.first_release_date && new Date(g.first_release_date * 1000).getFullYear() === 2024
    );
    console.log("TTYD remake IGDB:", remakeIgdb?.slug ?? "not found");

    const switchPlatform = await prisma.platform.findUnique({ where: { slug: "switch" } });
    if (switchPlatform) {
      const game = await prisma.game.create({
        data: {
          gameFamilyId: ttyd.id,
          platformId: switchPlatform.id,
          releaseDate: new Date("2024-05-23"),
          coverUrl: remakeIgdb?.cover?.image_id
            ? getCoverUrl(remakeIgdb.cover.image_id, "cover_big")
            : null,
          versions: { connect: [{ id: remakeVersion.id }] },
        },
      });
      await prisma.gameVersionReleaseDate.upsert({
        where: {
          gameId_gameVersionId: { gameId: game.id, gameVersionId: remakeVersion.id },
        },
        update: { releaseDate: new Date("2024-05-23") },
        create: {
          gameId: game.id,
          gameVersionId: remakeVersion.id,
          releaseDate: new Date("2024-05-23"),
        },
      });
      console.log("TTYD switch remake: created");
    }
  } else {
    console.log("TTYD switch: already exists or family missing");
  }

  // --- Color Splash (missing entirely) ---
  const csExisting = await prisma.gameFamily.findFirst({
    where: { title: { equals: "Paper Mario: Color Splash", mode: "insensitive" } },
  });
  if (!csExisting) {
    const [igdb] = await igdbRequest<IGDBGame[]>(
      "games",
      `fields id, name, slug, summary, cover.image_id, first_release_date;
       where slug = "paper-mario-color-splash"; limit 1;`
    );
    const title = "Paper Mario: Color Splash";
    const family = await prisma.gameFamily.create({
      data: {
        title,
        slug: "paper-mario-color-splash",
        searchTitle: normalizeForSearch(title),
        description: igdb?.summary || null,
        coverUrl: igdb?.cover?.image_id ? getCoverUrl(igdb.cover.image_id, "cover_big") : null,
        releaseDate: new Date("2016-10-07"),
      },
    });
    const wiiU = await prisma.platform.findUnique({ where: { slug: "wii-u" } });
    if (wiiU) {
      await prisma.game.create({
        data: {
          gameFamilyId: family.id,
          platformId: wiiU.id,
          releaseDate: new Date("2016-10-07"),
          versions: { connect: [{ id: standard.id }] },
        },
      });
    }
    console.log("Color Splash: created");
  } else {
    console.log("Color Splash: already exists");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
