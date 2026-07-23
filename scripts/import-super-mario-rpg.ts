/**
 * Import Super Mario RPG (2023) - the Switch remake of Legend of the Seven
 * Stars, released 2023-11-17. Distinct title, so it gets its own family
 * (Samus Returns precedent). Also fixes the original's Virtual Console
 * dates, which carried the 1996 SNES date (Wii VC 2008-09-01, Wii U VC
 * 2016-06-30).
 */

import { PrismaClient } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";
import { normalizeForSearch } from "../src/lib/normalize-search.js";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Import Super Mario RPG (2023) ===\n");

  // Fix the original's VC dates
  for (const [slug, date] of [
    ["wii", "2008-09-01"],
    ["wii-u", "2016-06-30"],
  ] as const) {
    const game = await prisma.game.findFirst({
      where: {
        gameFamily: {
          title: { equals: "Super Mario RPG: Legend of the Seven Stars", mode: "insensitive" },
        },
        platform: { slug },
      },
    });
    if (game && game.releaseDate?.getTime() !== new Date(date).getTime()) {
      await prisma.game.update({
        where: { id: game.id },
        data: { releaseDate: new Date(date) },
      });
      console.log(`Original ${slug} VC: date -> ${date}`);
    }
  }

  const existing = await prisma.gameFamily.findFirst({
    where: {
      title: { equals: "Super Mario RPG", mode: "insensitive" },
      NOT: { title: { contains: "Seven Stars", mode: "insensitive" } },
    },
  });
  if (existing) {
    console.log("Remake family already exists");
    return;
  }

  // Exact name match, then pick the 2023 release (the loose-search lesson
  // from Live A Live)
  const results = await igdbRequest<IGDBGame[]>(
    "games",
    `fields id, name, slug, summary, cover.image_id, first_release_date;
     where name = "Super Mario RPG"; limit 10;`
  );
  const remake = results.find(
    (g) => g.first_release_date && new Date(g.first_release_date * 1000).getFullYear() === 2023
  );
  console.log("IGDB remake:", remake?.slug ?? "not found");

  const title = "Super Mario RPG";
  const family = await prisma.gameFamily.create({
    data: {
      title,
      slug: "super-mario-rpg-2023",
      searchTitle: normalizeForSearch(title),
      description: remake?.summary || null,
      coverUrl: remake?.cover?.image_id
        ? getCoverUrl(remake.cover.image_id, "cover_big")
        : null,
      releaseDate: new Date("2023-11-17"),
    },
  });
  console.log(`Created family: ${family.title}`);

  const switchPlatform = await prisma.platform.findUnique({ where: { slug: "switch" } });
  const standard = await prisma.gameVersion.findUnique({ where: { slug: "standard" } });
  if (!switchPlatform || !standard) {
    console.error("Switch platform or Standard version missing");
    return;
  }

  const game = await prisma.game.create({
    data: {
      gameFamilyId: family.id,
      platformId: switchPlatform.id,
      releaseDate: new Date("2023-11-17"),
      versions: { connect: [{ id: standard.id }] },
    },
  });
  console.log(`Created Switch game: ${game.id}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
