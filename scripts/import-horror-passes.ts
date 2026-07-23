/**
 * Horror franchises pass: Silent Hill, Dead Space, Resident Evil round 2
 * (2026-07-22).
 *
 * Silent Hill:
 * - Remove never-released entries: Silent Hills (cancelled 2015),
 *   "Silent Hill DS" (never existed)
 * - Create Silent Hill 2 (2024) remake and Silent Hill f (2025)
 * - Silent Hill HD Collection bundle (PS3/X360 2012-03-20) with
 *   compilation-only SH2/SH3 games on those platforms
 * - Add Downpour X360; fix NA dates (SH3, Origins PS2, Shattered
 *   Memories PS2/PSP)
 *
 * Dead Space:
 * - Dead Space 3 was seeded on xbox-one (never shipped there): move to
 *   xbox-360 and add PS3
 * - Create Dead Space (2023) remake
 *
 * Resident Evil round 2:
 * - Create Resident Evil: Deadly Silence (NDS 2006-02-07)
 * - Add RE1 Saturn port (1997) and Operation Raccoon City X360
 * - Bundles: RE Triple Pack (Switch 2019-10-29, RE4+5+6),
 *   RE Chronicles HD Collection (PS3 2012-06-26)
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

async function addGame(
  familyTitle: string,
  platformSlug: string,
  date: string,
  opts: { versionSlug?: string | null; coverUrl?: string | null } = {}
) {
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
  const versionSlug = opts.versionSlug === undefined ? "standard" : opts.versionSlug;
  const version = versionSlug
    ? await prisma.gameVersion.findUnique({ where: { slug: versionSlug } })
    : null;
  await prisma.game.create({
    data: {
      gameFamilyId: family.id,
      platformId: platform.id,
      releaseDate: new Date(date),
      coverUrl: opts.coverUrl ?? null,
      ...(version ? { versions: { connect: [{ id: version.id }] } } : {}),
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
    return;
  }
  const families = await prisma.gameFamily.findMany({
    where: {
      OR: opts.familyTitles.map((t) => ({ title: { equals: t, mode: "insensitive" as const } })),
    },
    select: { id: true },
  });
  if (families.length !== opts.familyTitles.length) {
    console.log(`${opts.name}: only ${families.length}/${opts.familyTitles.length} members, skipped`);
    return;
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
}

async function main() {
  console.log("=== Silent Hill ===\n");
  await removeIfUnowned("Silent Hills");
  await removeIfUnowned("Silent Hill DS");

  await createFamilyWithGames({
    title: "Silent Hill 2 (2024)",
    slug: "silent-hill-2-2024",
    igdbName: "Silent Hill 2",
    igdbYear: 2024,
    date: "2024-10-08",
    platforms: ["ps5", "steam"],
  });
  await createFamilyWithGames({
    title: "Silent Hill f",
    slug: "silent-hill-f",
    igdbName: "Silent Hill f",
    igdbYear: 2025,
    date: "2025-09-25",
    platforms: ["ps5", "xbox-series", "steam"],
  });

  // HD Collection: compilation-only SH2/SH3 games + bundle
  await addGame("Silent Hill 2", "ps3", "2012-03-20", { versionSlug: null });
  await addGame("Silent Hill 2", "xbox-360", "2012-03-20", { versionSlug: null });
  await addGame("Silent Hill 3", "ps3", "2012-03-20", { versionSlug: null });
  await addGame("Silent Hill 3", "xbox-360", "2012-03-20", { versionSlug: null });
  await createBundle({
    name: "Silent Hill HD Collection",
    slug: "silent-hill-hd-collection",
    igdbName: "Silent Hill HD Collection",
    igdbYear: 2012,
    date: "2012-03-20",
    platforms: ["ps3", "xbox-360"],
    familyTitles: ["Silent Hill 2", "Silent Hill 3"],
  });

  await addGame("Silent Hill: Downpour", "xbox-360", "2012-03-13");
  await fixDate("Silent Hill 3", "ps2", "2003-08-05");
  await fixDate("Silent Hill: Origins", "ps2", "2008-03-04");
  await fixDate("Silent Hill: Shattered Memories", "ps2", "2010-01-19");
  await fixDate("Silent Hill: Shattered Memories", "psp", "2010-01-19");

  console.log("\n=== Dead Space ===\n");
  // DS3 never shipped on Xbox One: re-platform the seeded row to X360
  const ds3 = await prisma.gameFamily.findFirst({
    where: { title: { equals: "Dead Space 3", mode: "insensitive" } },
    include: { games: { include: { platform: true } } },
  });
  if (ds3) {
    const wrongRow = ds3.games.find((g) => g.platform?.slug === "xbox-one");
    const hasX360 = ds3.games.some((g) => g.platform?.slug === "xbox-360");
    const x360 = await prisma.platform.findUnique({ where: { slug: "xbox-360" } });
    if (wrongRow && !hasX360 && x360) {
      await prisma.game.update({
        where: { id: wrongRow.id },
        data: { platformId: x360.id },
      });
      console.log("Dead Space 3: xbox-one row moved to xbox-360");
    }
    await addGame("Dead Space 3", "ps3", "2013-02-05");
  }
  await createFamilyWithGames({
    title: "Dead Space (2023)",
    slug: "dead-space-2023",
    igdbName: "Dead Space",
    igdbYear: 2023,
    date: "2023-01-27",
    platforms: ["ps5", "xbox-series", "steam"],
  });

  console.log("\n=== Resident Evil round 2 ===\n");
  await createFamilyWithGames({
    title: "Resident Evil: Deadly Silence",
    slug: "resident-evil-deadly-silence",
    igdbName: "Resident Evil: Deadly Silence",
    igdbYear: 2006,
    date: "2006-02-07",
    platforms: ["nds"],
  });
  await addGame("Resident Evil", "saturn", "1997-08-31");
  await addGame("Resident Evil: Operation Raccoon City", "xbox-360", "2012-03-20");

  await createBundle({
    name: "Resident Evil Triple Pack",
    slug: "resident-evil-triple-pack",
    igdbName: "Resident Evil Triple Pack",
    igdbYear: 2019,
    date: "2019-10-29",
    platforms: ["switch"],
    familyTitles: ["Resident Evil 4", "Resident Evil 5", "Resident Evil 6"],
  });
  await createBundle({
    name: "Resident Evil: Chronicles HD Collection",
    slug: "resident-evil-chronicles-hd-collection",
    igdbName: "Resident Evil: Chronicles HD Collection",
    igdbYear: 2012,
    date: "2012-06-26",
    platforms: ["ps3"],
    familyTitles: [
      "Resident Evil: The Umbrella Chronicles",
      "Resident Evil: The Darkside Chronicles",
    ],
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
