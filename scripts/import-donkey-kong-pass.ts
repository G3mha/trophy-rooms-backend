/**
 * Donkey Kong series pass (2026-07-22).
 *
 * - Remove cancelled games seeded as real: Donkey Kong Racing (GC),
 *   Diddy Kong Pilot (GBA), Donkey Kong: Coconut Crackers (GBA)
 * - Merge duplicate GBA-port families into the canonical DKC 2/3 families
 *   with correct NA dates
 * - Create missing families: Donkey Kong / Jr. / 3 (NES), Donkey Kong
 *   (1994, Game Boy), Donkey Konga 1/2, Diddy Kong Racing DS,
 *   DKC Returns 3D, DKC Returns HD
 * - Add missing platform entries: Tropical Freeze Switch (2018-05-04),
 *   Jungle Beat Wii (2009-05-04), Mario vs. DK Switch remake (2024-02-16)
 * - Fix NA dates: DKC1 SNES, DKC2 SNES, Jungle Beat GC, Jungle Climber,
 *   King of Swing GBA, DK64 Wii U VC
 */

import { PrismaClient } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";
import { normalizeForSearch } from "../src/lib/normalize-search.js";

const prisma = new PrismaClient();

async function igdbByName(name: string, year?: number): Promise<IGDBGame | null> {
  try {
    const escaped = name.replace(/"/g, '\\"');
    const results = await igdbRequest<IGDBGame[]>(
      "games",
      `fields id, name, slug, summary, cover.image_id, first_release_date;
       where name = "${escaped}"; limit 10;`
    );
    if (year) {
      return (
        results.find(
          (g) => g.first_release_date && new Date(g.first_release_date * 1000).getFullYear() === year
        ) ?? null
      );
    }
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

async function addGame(familyTitle: string, platformSlug: string, date: string, versionSlug = "standard", coverUrl: string | null = null) {
  const family = await prisma.gameFamily.findFirst({
    where: { title: { equals: familyTitle, mode: "insensitive" } },
  });
  const platform = await prisma.platform.findUnique({ where: { slug: platformSlug } });
  const version = await prisma.gameVersion.findUnique({ where: { slug: versionSlug } });
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
  await prisma.game.create({
    data: {
      gameFamilyId: family.id,
      platformId: platform.id,
      releaseDate: new Date(date),
      coverUrl,
      ...(version ? { versions: { connect: [{ id: version.id }] } } : {}),
    },
  });
  console.log(`${familyTitle} ${platformSlug}: created`);
}

async function createFamilyWithGame(opts: {
  title: string;
  slug: string;
  igdbName: string;
  igdbYear?: number;
  platformSlug: string;
  date: string;
  useIgdbDate?: boolean;
}) {
  const existing = await prisma.gameFamily.findFirst({
    where: { OR: [{ slug: opts.slug }, { title: { equals: opts.title, mode: "insensitive" } }] },
  });
  if (existing) {
    console.log(`${opts.title}: already exists`);
    return;
  }
  const igdb = await igdbByName(opts.igdbName, opts.igdbYear);
  const date =
    opts.useIgdbDate && igdb?.first_release_date
      ? new Date(igdb.first_release_date * 1000)
      : new Date(opts.date);
  const family = await prisma.gameFamily.create({
    data: {
      title: opts.title,
      slug: opts.slug,
      searchTitle: normalizeForSearch(opts.title),
      description: igdb?.summary || null,
      coverUrl: coverOf(igdb),
      releaseDate: date,
    },
  });
  const platform = await prisma.platform.findUnique({ where: { slug: opts.platformSlug } });
  const standard = await prisma.gameVersion.findUnique({ where: { slug: "standard" } });
  if (platform) {
    await prisma.game.create({
      data: {
        gameFamilyId: family.id,
        platformId: platform.id,
        releaseDate: date,
        ...(standard ? { versions: { connect: [{ id: standard.id }] } } : {}),
      },
    });
  }
  console.log(`${opts.title}: created (IGDB ${igdb ? igdb.slug : "not found"})`);
}

async function main() {
  console.log("=== Donkey Kong series pass ===\n");

  // --- Cancelled games ---
  await removeIfUnowned("Donkey Kong Racing");
  await removeIfUnowned("Diddy Kong Pilot");
  await removeIfUnowned("Donkey Kong: Coconut Crackers");

  // --- Duplicate GBA-port families -> canonical families ---
  await removeIfUnowned("Donkey Kong Country 2");
  await removeIfUnowned("Donkey Kong Country 3");
  await addGame("Donkey Kong Country 2: Diddy's Kong Quest", "gba", "2004-11-15");
  await addGame("Donkey Kong Country 3: Dixie Kong's Double Trouble!", "gba", "2005-11-07");

  // --- Missing families ---
  console.log("");
  await createFamilyWithGame({
    title: "Donkey Kong", slug: "donkey-kong-nes",
    igdbName: "Donkey Kong", igdbYear: 1981,
    platformSlug: "nes", date: "1986-06-01", useIgdbDate: false,
  });
  await createFamilyWithGame({
    title: "Donkey Kong Jr.", slug: "donkey-kong-jr",
    igdbName: "Donkey Kong Jr.", igdbYear: 1982,
    platformSlug: "nes", date: "1986-06-01",
  });
  await createFamilyWithGame({
    title: "Donkey Kong 3", slug: "donkey-kong-3",
    igdbName: "Donkey Kong 3", igdbYear: 1983,
    platformSlug: "nes", date: "1986-06-01",
  });
  await createFamilyWithGame({
    title: "Donkey Kong (1994)", slug: "donkey-kong-1994",
    igdbName: "Donkey Kong", igdbYear: 1994,
    platformSlug: "game-boy", date: "1994-06-14", useIgdbDate: true,
  });
  await createFamilyWithGame({
    title: "Donkey Konga", slug: "donkey-konga",
    igdbName: "Donkey Konga",
    platformSlug: "gamecube", date: "2004-09-27",
  });
  await createFamilyWithGame({
    title: "Donkey Konga 2", slug: "donkey-konga-2",
    igdbName: "Donkey Konga 2",
    platformSlug: "gamecube", date: "2005-05-09",
  });
  await createFamilyWithGame({
    title: "Diddy Kong Racing DS", slug: "diddy-kong-racing-ds",
    igdbName: "Diddy Kong Racing DS",
    platformSlug: "nds", date: "2007-02-05",
  });
  await createFamilyWithGame({
    title: "Donkey Kong Country Returns 3D", slug: "donkey-kong-country-returns-3d",
    igdbName: "Donkey Kong Country Returns 3D",
    platformSlug: "3ds", date: "2013-05-24",
  });
  await createFamilyWithGame({
    title: "Donkey Kong Country Returns HD", slug: "donkey-kong-country-returns-hd",
    igdbName: "Donkey Kong Country Returns HD",
    platformSlug: "switch", date: "2025-01-16",
  });

  // --- Missing platform entries ---
  console.log("");
  await addGame("Donkey Kong Country: Tropical Freeze", "switch", "2018-05-04");
  await addGame("Donkey Kong Jungle Beat", "wii", "2009-05-04");

  // Mario vs. Donkey Kong 2024 remake: same title -> same family + Remake version
  const mvdk = await prisma.gameFamily.findFirst({
    where: { title: { equals: "Mario vs. Donkey Kong", mode: "insensitive" } },
    include: { games: { include: { platform: true } } },
  });
  if (mvdk && !mvdk.games.some((g) => g.platform?.slug === "switch")) {
    const remakeIgdb = await igdbByName("Mario vs. Donkey Kong", 2024);
    const switchPlatform = await prisma.platform.findUnique({ where: { slug: "switch" } });
    const remakeVersion = await prisma.gameVersion.findUnique({ where: { slug: "remake" } });
    if (switchPlatform && remakeVersion) {
      const game = await prisma.game.create({
        data: {
          gameFamilyId: mvdk.id,
          platformId: switchPlatform.id,
          releaseDate: new Date("2024-02-16"),
          coverUrl: coverOf(remakeIgdb),
          versions: { connect: [{ id: remakeVersion.id }] },
        },
      });
      await prisma.gameVersionReleaseDate.upsert({
        where: { gameId_gameVersionId: { gameId: game.id, gameVersionId: remakeVersion.id } },
        update: { releaseDate: new Date("2024-02-16") },
        create: { gameId: game.id, gameVersionId: remakeVersion.id, releaseDate: new Date("2024-02-16") },
      });
      console.log("Mario vs. Donkey Kong switch remake: created");
    }
  } else {
    console.log("Mario vs. Donkey Kong switch: already exists or family missing");
  }

  // --- NA date fixes ---
  console.log("");
  await fixDate("Donkey Kong Country", "snes", "1994-11-21");
  await fixDate("Donkey Kong Country 2: Diddy's Kong Quest", "snes", "1995-11-20");
  await fixDate("Donkey Kong Jungle Beat", "gamecube", "2005-03-14");
  await fixDate("DK: Jungle Climber", "nds", "2007-09-10");
  await fixDate("DK: King of Swing", "gba", "2005-09-19");
  await fixDate("Donkey Kong 64", "wii-u", "2015-04-16");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
