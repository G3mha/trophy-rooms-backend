/**
 * Ace Attorney series pass (2026-07-22).
 *
 * - Convert compilation families to COLLECTION bundles per the data model
 *   rules: Phoenix Wright: Ace Attorney Trilogy (JP 3DS 2014-04-17, then
 *   2019 console wave incl. the JP Switch cartridge), Ace Attorney
 *   Anthology (2024 physical, both trilogies), The Great Ace Attorney
 *   Chronicles (2021, over Adventures + Resolve)
 * - Create missing bundles: Apollo Justice: Ace Attorney Trilogy
 *   (2024-01-25), Ace Attorney Investigations Collection (2024-09-06)
 * - Add the JP 3DS originals for The Great Ace Attorney games
 * - Fix dates seeded from the wrong region: PW:AA NDS (NA 2005-10-11),
 *   Justice for All NDS (NA 2007-01-16), Trials and Tribulations NDS
 *   (NA 2007-10-23), Apollo Justice 3DS port (NA 2017-11-21),
 *   Dual Destinies (NA 2013-10-24), Layton vs. Wright (NA 2014-08-29)
 */

import { PrismaClient, BundleType } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

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

async function familyUserData(familyId: string): Promise<number> {
  const family = await prisma.gameFamily.findUnique({
    where: { id: familyId },
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
  if (!family) return 0;
  return (
    family.games.reduce(
      (sum, g) =>
        sum + g._count.userGames + g._count.collectionItems + g._count.trophies + g._count.buylistItems,
      0
    ) + family._count.buylistItems
  );
}

async function createBundle(opts: {
  name: string;
  slug: string;
  igdbName: string;
  igdbYear: number;
  date: string;
  platforms: string[];
  familyTitles: string[];
}) {
  const existing = await prisma.bundle.findUnique({ where: { slug: opts.slug } });
  if (existing) {
    console.log(`${opts.name}: bundle already exists`);
    return true;
  }
  const families = await prisma.gameFamily.findMany({
    where: {
      OR: opts.familyTitles.map((t) => ({ title: { equals: t, mode: "insensitive" as const } })),
    },
    select: { id: true },
  });
  if (families.length !== opts.familyTitles.length) {
    console.error(`${opts.name}: only ${families.length}/${opts.familyTitles.length} members, skipped`);
    return false;
  }
  const platformIds: string[] = [];
  for (const slug of opts.platforms) {
    const p = await prisma.platform.findUnique({ where: { slug } });
    if (p) platformIds.push(p.id);
  }
  const igdb = await igdbExact(opts.igdbName, opts.igdbYear);
  await prisma.bundle.create({
    data: {
      name: opts.name,
      slug: opts.slug,
      type: BundleType.COLLECTION,
      description: igdb?.summary || null,
      coverUrl: coverOf(igdb),
      releaseDate: new Date(opts.date),
      platforms: { connect: platformIds.map((id) => ({ id })) },
      gameFamilies: { connect: families.map((f) => ({ id: f.id })) },
    },
  });
  console.log(`Created bundle: ${opts.name}`);
  return true;
}

async function convertFamilyToBundle(opts: {
  familyTitle: string;
  bundle: Parameters<typeof createBundle>[0];
}) {
  const family = await prisma.gameFamily.findFirst({
    where: { title: { equals: opts.familyTitle, mode: "insensitive" } },
  });
  const created = await createBundle(opts.bundle);
  if (!created || !family) return;
  const data = await familyUserData(family.id);
  if (data > 0) {
    console.error(`${opts.familyTitle}: family has user data, kept alongside bundle`);
    return;
  }
  await prisma.gameFamily.delete({ where: { id: family.id } });
  console.log(`${opts.familyTitle}: compilation family removed (now a bundle)`);
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
  if (!family || !platform) return;
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

async function main() {
  console.log("=== Ace Attorney series pass ===\n");

  // --- Compilation families -> bundles ---
  await convertFamilyToBundle({
    familyTitle: "Phoenix Wright: Ace Attorney Trilogy",
    bundle: {
      name: "Phoenix Wright: Ace Attorney Trilogy",
      slug: "phoenix-wright-ace-attorney-trilogy",
      igdbName: "Phoenix Wright: Ace Attorney Trilogy",
      igdbYear: 2019,
      date: "2014-04-17",
      platforms: ["3ds", "switch", "ps4", "xbox-one", "steam"],
      familyTitles: [
        "Phoenix Wright: Ace Attorney",
        "Phoenix Wright: Ace Attorney - Justice for All",
        "Phoenix Wright: Ace Attorney - Trials and Tribulations",
      ],
    },
  });

  await convertFamilyToBundle({
    familyTitle: "Ace Attorney Anthology",
    bundle: {
      name: "Ace Attorney Anthology",
      slug: "ace-attorney-anthology",
      igdbName: "Ace Attorney Anthology",
      igdbYear: 2024,
      date: "2024-06-06",
      platforms: ["switch", "ps4", "xbox-one", "xbox-series", "steam"],
      familyTitles: [
        "Phoenix Wright: Ace Attorney",
        "Phoenix Wright: Ace Attorney - Justice for All",
        "Phoenix Wright: Ace Attorney - Trials and Tribulations",
        "Apollo Justice: Ace Attorney",
        "Phoenix Wright: Ace Attorney - Dual Destinies",
        "Phoenix Wright: Ace Attorney - Spirit of Justice",
      ],
    },
  });

  await convertFamilyToBundle({
    familyTitle: "The Great Ace Attorney Chronicles",
    bundle: {
      name: "The Great Ace Attorney Chronicles",
      slug: "the-great-ace-attorney-chronicles",
      igdbName: "The Great Ace Attorney Chronicles",
      igdbYear: 2021,
      date: "2021-07-27",
      platforms: ["switch", "ps4", "steam"],
      familyTitles: [
        "The Great Ace Attorney: Adventures",
        "The Great Ace Attorney 2: Resolve",
      ],
    },
  });

  // --- Missing 2024 collections ---
  await createBundle({
    name: "Apollo Justice: Ace Attorney Trilogy",
    slug: "apollo-justice-ace-attorney-trilogy",
    igdbName: "Apollo Justice: Ace Attorney Trilogy",
    igdbYear: 2024,
    date: "2024-01-25",
    platforms: ["switch", "ps4", "xbox-one", "steam"],
    familyTitles: [
      "Apollo Justice: Ace Attorney",
      "Phoenix Wright: Ace Attorney - Dual Destinies",
      "Phoenix Wright: Ace Attorney - Spirit of Justice",
    ],
  });

  await createBundle({
    name: "Ace Attorney Investigations Collection",
    slug: "ace-attorney-investigations-collection",
    igdbName: "Ace Attorney Investigations Collection",
    igdbYear: 2024,
    date: "2024-09-06",
    platforms: ["switch", "ps4", "xbox-one", "steam"],
    familyTitles: [
      "Ace Attorney Investigations: Miles Edgeworth",
      "Ace Attorney Investigations 2: Prosecutor's Gambit",
    ],
  });

  // --- JP 3DS originals for The Great Ace Attorney ---
  console.log("");
  await addGame("The Great Ace Attorney: Adventures", "3ds", "2015-07-09");
  await addGame("The Great Ace Attorney 2: Resolve", "3ds", "2017-08-03");

  // --- Region date fixes ---
  console.log("");
  await fixDate("Phoenix Wright: Ace Attorney", "nds", "2005-10-11");
  await fixDate("Phoenix Wright: Ace Attorney - Justice for All", "nds", "2007-01-16");
  await fixDate("Phoenix Wright: Ace Attorney - Trials and Tribulations", "nds", "2007-10-23");
  await fixDate("Apollo Justice: Ace Attorney", "3ds", "2017-11-21");
  await fixDate("Phoenix Wright: Ace Attorney - Dual Destinies", "3ds", "2013-10-24");
  await fixDate("Professor Layton vs. Phoenix Wright: Ace Attorney", "3ds", "2014-08-29");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
