/**
 * Metal Slug series pass (2026-07-23).
 *
 * - Add the Neo Geo originals for MS1-5 (the series' actual platform,
 *   absent from every family)
 * - Create Metal Slug X (Neo Geo 1999 + PS1 port + Switch ACA) and
 *   Metal Slug XX (PSP 2010-02-23)
 * - Add the ACA NeoGeo Switch releases: MS3 2017-03-09, MS1 2017-03-30,
 *   MS2 2017-07-06, X 2017-10-05, MS4 2018-08-09, MS5 2018-12-13
 * - Metal Slug Anthology as a COLLECTION bundle (Wii/PSP/PS2/PS4,
 *   2006-12-14) over MS1, 2, X, 3, 4, 5, 6
 * - Date fixes: MS7 NDS NA (2008-11-18), MS1 PSP/PS3 NeoGeo Station
 *   (2010-12-21), MS3 Neo Geo placement (2000-06-01)
 *
 * Other legacy re-release dates (Wii VC, XBLA, Vita) are left as seeded -
 * their exact dates were not verifiable in this pass.
 */

import { PrismaClient, BundleType } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";
import { normalizeForSearch } from "../src/lib/normalize-search.js";

const prisma = new PrismaClient();

async function igdbExact(name: string, year: number): Promise<IGDBGame | null> {
  try {
    const escaped = name.replace(/"/g, '\\"');
    const from = Math.floor(new Date(`${year - 1}-01-01`).getTime() / 1000);
    const to = Math.floor(new Date(`${year + 2}-01-01`).getTime() / 1000);
    const results = await igdbRequest<IGDBGame[]>(
      "games",
      `fields id, name, slug, summary, cover.image_id, first_release_date;
       where name = "${escaped}" & first_release_date >= ${from} & first_release_date < ${to};
       limit 5;`
    );
    return results[0] ?? null;
  } catch {
    return null;
  }
}

function coverOf(game: IGDBGame | null): string | null {
  return game?.cover?.image_id ? getCoverUrl(game.cover.image_id, "cover_big") : null;
}

async function addGame(familyTitle: string, platformSlug: string, date: string) {
  const family = await prisma.gameFamily.findFirst({
    where: { title: { equals: familyTitle, mode: "insensitive" } },
  });
  const platform = await prisma.platform.findUnique({ where: { slug: platformSlug } });
  if (!family || !platform) {
    console.log(`${familyTitle} ${platformSlug}: family or platform missing`);
    return;
  }
  const existing = await prisma.game.findFirst({
    where: { gameFamilyId: family.id, platformId: platform.id },
  });
  if (existing) {
    console.log(`${familyTitle} ${platformSlug}: already exists`);
    return;
  }
  const standard = await prisma.gameVersion.findUnique({ where: { slug: "standard" } });
  await prisma.game.create({
    data: {
      gameFamilyId: family.id,
      platformId: platform.id,
      releaseDate: new Date(date),
      ...(standard ? { versions: { connect: [{ id: standard.id }] } } : {}),
    },
  });
  console.log(`${familyTitle} ${platformSlug}: created`);
}

async function fixDate(familyTitle: string, platformSlug: string, date: string) {
  const game = await prisma.game.findFirst({
    where: {
      gameFamily: { title: { equals: familyTitle, mode: "insensitive" } },
      platform: { slug: platformSlug },
    },
  });
  if (!game) return;
  const target = new Date(date);
  if (game.releaseDate?.getTime() === target.getTime()) return;
  await prisma.game.update({ where: { id: game.id }, data: { releaseDate: target } });
  console.log(`${familyTitle} ${platformSlug}: date -> ${date}`);
}

async function createFamilyWithGames(opts: {
  title: string;
  slug: string;
  igdbYear: number;
  familyDate: string;
  games: Array<{ platformSlug: string; date: string }>;
}) {
  const existing = await prisma.gameFamily.findFirst({
    where: { OR: [{ slug: opts.slug }, { title: { equals: opts.title, mode: "insensitive" } }] },
  });
  if (existing) {
    console.log(`${opts.title}: already exists`);
    return;
  }
  const igdb = await igdbExact(opts.title, opts.igdbYear);
  const family = await prisma.gameFamily.create({
    data: {
      title: opts.title,
      slug: opts.slug,
      searchTitle: normalizeForSearch(opts.title),
      description: igdb?.summary || null,
      coverUrl: coverOf(igdb),
      releaseDate: new Date(opts.familyDate),
    },
  });
  const standard = await prisma.gameVersion.findUnique({ where: { slug: "standard" } });
  for (const g of opts.games) {
    const platform = await prisma.platform.findUnique({ where: { slug: g.platformSlug } });
    if (!platform) continue;
    await prisma.game.create({
      data: {
        gameFamilyId: family.id,
        platformId: platform.id,
        releaseDate: new Date(g.date),
        ...(standard ? { versions: { connect: [{ id: standard.id }] } } : {}),
      },
    });
  }
  console.log(`${opts.title}: created (IGDB ${igdb ? igdb.slug : "not found"})`);
}

async function main() {
  console.log("=== Metal Slug series pass ===\n");

  // --- Neo Geo originals ---
  await addGame("Metal Slug", "neo-geo", "1996-04-19");
  await addGame("Metal Slug 2", "neo-geo", "1998-02-23");
  await addGame("Metal Slug 3", "neo-geo", "2000-06-01");
  await addGame("Metal Slug 4", "neo-geo", "2002-03-27");
  await addGame("Metal Slug 5", "neo-geo", "2003-11-14");

  // --- Missing families ---
  console.log("");
  await createFamilyWithGames({
    title: "Metal Slug X",
    slug: "metal-slug-x",
    igdbYear: 1999,
    familyDate: "1999-03-19",
    games: [
      { platformSlug: "neo-geo", date: "1999-03-19" },
      { platformSlug: "ps1", date: "2001-05-15" },
      { platformSlug: "switch", date: "2017-10-05" },
    ],
  });
  await createFamilyWithGames({
    title: "Metal Slug XX",
    slug: "metal-slug-xx",
    igdbYear: 2010,
    familyDate: "2010-02-23",
    games: [{ platformSlug: "psp", date: "2010-02-23" }],
  });

  // --- ACA NeoGeo Switch releases ---
  console.log("");
  await addGame("Metal Slug", "switch", "2017-03-30");
  await addGame("Metal Slug 2", "switch", "2017-07-06");
  await addGame("Metal Slug 3", "switch", "2017-03-09");
  await addGame("Metal Slug 4", "switch", "2018-08-09");
  await addGame("Metal Slug 5", "switch", "2018-12-13");

  // --- Metal Slug Anthology bundle ---
  console.log("");
  const existingBundle = await prisma.bundle.findUnique({
    where: { slug: "metal-slug-anthology" },
  });
  if (!existingBundle) {
    const memberTitles = [
      "Metal Slug",
      "Metal Slug 2",
      "Metal Slug X",
      "Metal Slug 3",
      "Metal Slug 4",
      "Metal Slug 5",
      "Metal Slug 6",
    ];
    const members = await prisma.gameFamily.findMany({
      where: {
        OR: memberTitles.map((t) => ({ title: { equals: t, mode: "insensitive" as const } })),
      },
      select: { id: true },
    });
    const platformIds: string[] = [];
    for (const slug of ["wii", "psp", "ps2", "ps4"]) {
      const p = await prisma.platform.findUnique({ where: { slug } });
      if (p) platformIds.push(p.id);
    }
    if (members.length === memberTitles.length) {
      const igdb = await igdbExact("Metal Slug Anthology", 2006);
      await prisma.bundle.create({
        data: {
          name: "Metal Slug Anthology",
          slug: "metal-slug-anthology",
          type: BundleType.COLLECTION,
          description: igdb?.summary || null,
          coverUrl: coverOf(igdb),
          releaseDate: new Date("2006-12-14"),
          platforms: { connect: platformIds.map((id) => ({ id })) },
          gameFamilies: { connect: members.map((m) => ({ id: m.id })) },
        },
      });
      console.log("Created bundle: Metal Slug Anthology (7 member families)");
    } else {
      console.log(`Anthology: only ${members.length}/7 members, skipped`);
    }
  } else {
    console.log("Anthology bundle already exists");
  }

  // --- Date fixes ---
  console.log("");
  await fixDate("Metal Slug 7", "nds", "2008-11-18");
  await fixDate("Metal Slug", "psp", "2010-12-21");
  await fixDate("Metal Slug", "ps3", "2010-12-21");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
