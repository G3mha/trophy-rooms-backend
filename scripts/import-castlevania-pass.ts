/**
 * Castlevania series pass (2026-07-22).
 *
 * - Remove Castlevania: Resurrection (cancelled Dreamcast game)
 * - Create missing families: Castlevania: Dracula X (SNES 1995),
 *   Castlevania (1999) + Legacy of Darkness (N64), The Adventure ReBirth
 *   (WiiWare 2009), Lords of Shadow 2 (2014)
 * - Rondo of Blood: add the TurboGrafx-16 original (JP 1993-10-29) and fix
 *   the Wii VC date (2010-03-15); the PSP entry is Dracula X Chronicles
 * - Curse of Darkness: add the Xbox release
 * - Date fixes: SotN PS1 (JP -> NA 1997-10-02), SotN PSP (in DXC,
 *   2007-10-23), SotN X360 (XBLA 2007-03-21), Dawn of Sorrow NA
 *   (2005-10-04), Super Castlevania IV NA (1991-12-04)
 */

import { PrismaClient } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";
import { normalizeForSearch } from "../src/lib/normalize-search.js";

const prisma = new PrismaClient();

async function igdbExact(name: string, year: number): Promise<IGDBGame | null> {
  try {
    const escaped = name.replace(/"/g, '\\"');
    const from = Math.floor(new Date(`${year - 1}-06-01`).getTime() / 1000);
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

async function removeIfUnowned(title: string) {
  const family = await prisma.gameFamily.findFirst({
    where: { title: { equals: title, mode: "insensitive" } },
    include: {
      games: {
        include: {
          _count: {
            select: { userGames: true, collectionItems: true, trophies: true, buylistItems: true },
          },
        },
      },
      _count: { select: { buylistItems: true } },
    },
  });
  if (!family) {
    console.log(`${title}: not found`);
    return;
  }
  const data = family.games.reduce(
    (sum, g) =>
      sum + g._count.userGames + g._count.collectionItems + g._count.trophies + g._count.buylistItems,
    0
  );
  if (data + family._count.buylistItems > 0) {
    console.error(`${title}: has user data, refusing to delete`);
    return;
  }
  await prisma.gameFamily.delete({ where: { id: family.id } });
  console.log(`${title}: deleted`);
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

async function createFamilyWithGames(opts: {
  title: string;
  slug: string;
  igdbName: string;
  igdbYear: number;
  date: string;
  platforms: string[];
}) {
  const existing = await prisma.gameFamily.findFirst({
    where: { OR: [{ slug: opts.slug }, { title: { equals: opts.title, mode: "insensitive" } }] },
  });
  if (existing) {
    console.log(`${opts.title}: already exists`);
    return;
  }
  const igdb = await igdbExact(opts.igdbName, opts.igdbYear);
  const family = await prisma.gameFamily.create({
    data: {
      title: opts.title,
      slug: opts.slug,
      searchTitle: normalizeForSearch(opts.title),
      description: igdb?.summary || null,
      coverUrl: coverOf(igdb),
      releaseDate: new Date(opts.date),
    },
  });
  const standard = await prisma.gameVersion.findUnique({ where: { slug: "standard" } });
  for (const slug of opts.platforms) {
    const platform = await prisma.platform.findUnique({ where: { slug } });
    if (!platform) continue;
    await prisma.game.create({
      data: {
        gameFamilyId: family.id,
        platformId: platform.id,
        releaseDate: new Date(opts.date),
        ...(standard ? { versions: { connect: [{ id: standard.id }] } } : {}),
      },
    });
  }
  console.log(`${opts.title}: created (IGDB ${igdb ? igdb.slug : "not found"})`);
}

async function main() {
  console.log("=== Castlevania series pass ===\n");

  await removeIfUnowned("Castlevania: Resurrection");

  await createFamilyWithGames({
    title: "Castlevania: Dracula X",
    slug: "castlevania-dracula-x",
    igdbName: "Castlevania: Dracula X",
    igdbYear: 1995,
    date: "1995-09-01",
    platforms: ["snes"],
  });
  await createFamilyWithGames({
    title: "Castlevania (1999)",
    slug: "castlevania-1999",
    igdbName: "Castlevania",
    igdbYear: 1999,
    date: "1999-01-26",
    platforms: ["n64"],
  });
  await createFamilyWithGames({
    title: "Castlevania: Legacy of Darkness",
    slug: "castlevania-legacy-of-darkness",
    igdbName: "Castlevania: Legacy of Darkness",
    igdbYear: 1999,
    date: "1999-11-30",
    platforms: ["n64"],
  });
  await createFamilyWithGames({
    title: "Castlevania: The Adventure ReBirth",
    slug: "castlevania-the-adventure-rebirth",
    igdbName: "Castlevania: The Adventure ReBirth",
    igdbYear: 2009,
    date: "2009-12-28",
    platforms: ["wii"],
  });
  await createFamilyWithGames({
    title: "Castlevania: Lords of Shadow 2",
    slug: "castlevania-lords-of-shadow-2",
    igdbName: "Castlevania: Lords of Shadow 2",
    igdbYear: 2014,
    date: "2014-02-25",
    platforms: ["ps3", "xbox-360"],
  });

  console.log("");
  await addGame("Castlevania: Rondo of Blood", "turbografx-16", "1993-10-29");
  await addGame("Castlevania: Curse of Darkness", "xbox", "2005-11-01");

  console.log("");
  await fixDate("Castlevania: Symphony of the Night", "ps1", "1997-10-02");
  await fixDate("Castlevania: Symphony of the Night", "psp", "2007-10-23");
  await fixDate("Castlevania: Symphony of the Night", "xbox-360", "2007-03-21");
  await fixDate("Castlevania: Rondo of Blood", "wii", "2010-03-15");
  await fixDate("Castlevania: Dawn of Sorrow", "nds", "2005-10-04");
  await fixDate("Super Castlevania IV", "snes", "1991-12-04");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
