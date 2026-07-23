/**
 * Kirby series pass (2026-07-22).
 *
 * - Remove cancelled/placeholder entries: Kid Kirby, Kirby Bowl 64,
 *   "Kirby's Air Ride" (empty dup), "Untitled Kirby Game"
 * - Create missing families: Kirby's Dream Course, Kirby's Avalanche,
 *   Kirby's Dream Land 2, Kirby Super Star, Kirby's Extra Epic Yarn,
 *   Dedede's Drum Dash Deluxe
 * - Kirby's Dream Collection: Special Edition as a COLLECTION bundle
 *   (Wii 2012-09-16) over the six classic families
 * - Fix NA dates: Dream Land 3 (null), Kirby 64, Nightmare in Dream Land,
 *   Amazing Mirror, Mass Attack, Battle Royale, Triple Deluxe,
 *   Planet Robobot, Block Ball
 */

import { PrismaClient, BundleType } from "@prisma/client";
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

async function createFamilyWithGame(opts: {
  title: string;
  slug: string;
  igdbName?: string;
  igdbYear: number;
  platformSlug: string;
  date: string;
}) {
  const existing = await prisma.gameFamily.findFirst({
    where: { OR: [{ slug: opts.slug }, { title: { equals: opts.title, mode: "insensitive" } }] },
  });
  if (existing) {
    console.log(`${opts.title}: already exists`);
    return;
  }
  const igdb = await igdbExact(opts.igdbName ?? opts.title, opts.igdbYear);
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
  const platform = await prisma.platform.findUnique({ where: { slug: opts.platformSlug } });
  const standard = await prisma.gameVersion.findUnique({ where: { slug: "standard" } });
  if (platform) {
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
  console.log("=== Kirby series pass ===\n");

  // --- Cancelled / placeholder entries ---
  await removeIfUnowned("Kid Kirby");
  await removeIfUnowned("Kirby Bowl 64");
  await removeIfUnowned("Kirby's Air Ride");
  await removeIfUnowned("Untitled Kirby Game");

  // --- Missing families ---
  console.log("");
  await createFamilyWithGame({
    title: "Kirby's Dream Course", slug: "kirbys-dream-course",
    igdbYear: 1994, platformSlug: "snes", date: "1995-02-01",
  });
  await createFamilyWithGame({
    title: "Kirby's Avalanche", slug: "kirbys-avalanche",
    igdbYear: 1995, platformSlug: "snes", date: "1995-04-25",
  });
  await createFamilyWithGame({
    title: "Kirby's Dream Land 2", slug: "kirbys-dream-land-2",
    igdbYear: 1995, platformSlug: "game-boy", date: "1995-05-01",
  });
  await createFamilyWithGame({
    title: "Kirby Super Star", slug: "kirby-super-star",
    igdbYear: 1996, platformSlug: "snes", date: "1996-09-20",
  });
  await createFamilyWithGame({
    title: "Kirby's Extra Epic Yarn", slug: "kirbys-extra-epic-yarn",
    igdbYear: 2019, platformSlug: "3ds", date: "2019-03-08",
  });
  await createFamilyWithGame({
    title: "Dedede's Drum Dash Deluxe", slug: "dededes-drum-dash-deluxe",
    igdbYear: 2014, platformSlug: "3ds", date: "2014-08-29",
  });

  // --- Kirby's Dream Collection bundle ---
  const existingBundle = await prisma.bundle.findUnique({
    where: { slug: "kirbys-dream-collection" },
  });
  if (!existingBundle) {
    const memberTitles = [
      "Kirby's Dream Land",
      "Kirby's Adventure",
      "Kirby's Dream Land 2",
      "Kirby Super Star",
      "Kirby's Dream Land 3",
      "Kirby 64: The Crystal Shards",
    ];
    const members = await prisma.gameFamily.findMany({
      where: {
        OR: memberTitles.map((t) => ({ title: { equals: t, mode: "insensitive" as const } })),
      },
      select: { id: true },
    });
    const wii = await prisma.platform.findUnique({ where: { slug: "wii" } });
    const igdb = await igdbExact("Kirby's Dream Collection: Special Edition", 2012);
    if (members.length === memberTitles.length && wii) {
      await prisma.bundle.create({
        data: {
          name: "Kirby's Dream Collection: Special Edition",
          slug: "kirbys-dream-collection",
          type: BundleType.COLLECTION,
          description: igdb?.summary || null,
          coverUrl: coverOf(igdb),
          releaseDate: new Date("2012-09-16"),
          platforms: { connect: [{ id: wii.id }] },
          gameFamilies: { connect: members.map((m) => ({ id: m.id })) },
        },
      });
      console.log("Created bundle: Kirby's Dream Collection: Special Edition");
    } else {
      console.log(`Dream Collection: only ${members.length}/6 members found, skipped`);
    }
  } else {
    console.log("Dream Collection bundle already exists");
  }

  // --- NA date fixes ---
  console.log("");
  await fixDate("Kirby's Dream Land 3", "snes", "1997-11-27");
  await fixDate("Kirby 64: The Crystal Shards", "n64", "2000-06-26");
  await fixDate("Kirby: Nightmare in Dream Land", "gba", "2002-12-02");
  await fixDate("Kirby & the Amazing Mirror", "gba", "2004-10-18");
  await fixDate("Kirby Mass Attack", "nds", "2011-09-19");
  await fixDate("Kirby Battle Royale", "3ds", "2018-01-19");
  await fixDate("Kirby: Triple Deluxe", "3ds", "2014-05-02");
  await fixDate("Kirby: Planet Robobot", "3ds", "2016-06-10");
  await fixDate("Kirby's Block Ball", "game-boy", "1996-05-01");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
