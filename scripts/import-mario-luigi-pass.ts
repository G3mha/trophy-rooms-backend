/**
 * Mario & Luigi series pass (2026-07-22).
 *
 * - Create Mario & Luigi: Dream Team (3DS 2013-08-11, missing entirely)
 * - Create the 3DS remakes as their own families (distinct titles):
 *   Superstar Saga + Bowser's Minions (2017-10-06),
 *   Bowser's Inside Story + Bowser Jr.'s Journey (2019-01-11)
 * - Fix dates: Superstar Saga Wii U VC 2014-04-03, Partners in Time Wii U
 *   VC 2015-06-25, Paper Jam NA date 2016-01-22 (was seeded with EU/JP)
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

async function main() {
  console.log("=== Mario & Luigi series pass ===\n");

  const standard = await prisma.gameVersion.findUnique({ where: { slug: "standard" } });
  if (!standard) {
    console.error("Standard version missing");
    return;
  }

  // --- Date fixes ---
  const dateFixes: Array<[string, string, string]> = [
    ["Mario & Luigi: Superstar Saga", "wii-u", "2014-04-03"],
    ["Mario & Luigi: Partners in Time", "wii-u", "2015-06-25"],
    ["Mario & Luigi: Paper Jam", "3ds", "2016-01-22"],
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

  // --- Missing families (all 3DS) ---
  const newFamilies = [
    {
      title: "Mario & Luigi: Dream Team",
      slug: "mario-and-luigi-dream-team",
      igdbSlug: "mario-and-luigi-dream-team",
      date: "2013-08-11",
    },
    {
      title: "Mario & Luigi: Superstar Saga + Bowser's Minions",
      slug: "mario-and-luigi-superstar-saga-plus-bowsers-minions",
      igdbSlug: "mario-and-luigi-superstar-saga-plus-bowsers-minions",
      date: "2017-10-06",
    },
    {
      title: "Mario & Luigi: Bowser's Inside Story + Bowser Jr.'s Journey",
      slug: "mario-and-luigi-bowsers-inside-story-plus-bowser-jrs-journey",
      igdbSlug: "mario-and-luigi-bowsers-inside-story-plus-bowser-jrs-journey",
      date: "2019-01-11",
    },
  ];

  const threeDS = await prisma.platform.findUnique({ where: { slug: "3ds" } });
  if (!threeDS) {
    console.error("3DS platform missing");
    return;
  }

  for (const nf of newFamilies) {
    const existing = await prisma.gameFamily.findFirst({
      where: {
        OR: [{ slug: nf.slug }, { title: { equals: nf.title, mode: "insensitive" } }],
      },
    });
    if (existing) {
      console.log(`${nf.title}: already exists`);
      continue;
    }
    const igdb = await igdbBySlug(nf.igdbSlug);
    const family = await prisma.gameFamily.create({
      data: {
        title: nf.title,
        slug: nf.slug,
        searchTitle: normalizeForSearch(nf.title),
        description: igdb?.summary || null,
        coverUrl: igdb?.cover?.image_id ? getCoverUrl(igdb.cover.image_id, "cover_big") : null,
        releaseDate: new Date(nf.date),
      },
    });
    await prisma.game.create({
      data: {
        gameFamilyId: family.id,
        platformId: threeDS.id,
        releaseDate: new Date(nf.date),
        versions: { connect: [{ id: standard.id }] },
      },
    });
    console.log(`${nf.title}: created (IGDB ${igdb ? "found" : "not found"})`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
