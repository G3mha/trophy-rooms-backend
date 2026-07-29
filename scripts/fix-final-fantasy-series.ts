/**
 * Final Fantasy series pass (2026-07-23), following the FFIII/VI fix.
 *
 * - Create the missing mainline families: Final Fantasy II (Famicom 1988),
 *   Final Fantasy IV (SNES NA 1991, sold there as "Final Fantasy II"; plus
 *   the DS 3D remake 2008 as a Remake version), Final Fantasy V (Super
 *   Famicom 1992, JP-only), and the original Final Fantasy VII (PS1 1997 +
 *   PS4/Switch/Xbox One ports)
 * - Final Fantasy XIII-2 was seeded on Xbox One (BC only): re-platform to
 *   Xbox 360 and add PS3
 * - Final Fantasy XV never shipped on Switch: remove the phantom entry
 */

import { PrismaClient } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";
import { normalizeForSearch } from "../src/lib/normalize-search.js";

const prisma = new PrismaClient();

async function igdbBySlug(slugs: string[]): Promise<IGDBGame | null> {
  for (const slug of slugs) {
    try {
      const [game] = await igdbRequest<IGDBGame[]>(
        "games",
        `fields id, name, slug, summary, cover.image_id, first_release_date;
         where slug = "${slug}"; limit 1;`
      );
      if (game) return game;
    } catch {
      // try next
    }
  }
  return null;
}

function coverOf(game: IGDBGame | null): string | null {
  return game?.cover?.image_id ? getCoverUrl(game.cover.image_id, "cover_big") : null;
}

async function createFamily(opts: {
  title: string;
  slug: string;
  igdbSlugs: string[];
  familyDate: string;
  games: Array<{ platformSlug: string; date: string; versionSlug?: string; coverIgdbSlugs?: string[] }>;
}) {
  const existing = await prisma.gameFamily.findFirst({
    where: { OR: [{ slug: opts.slug }, { title: { equals: opts.title, mode: "insensitive" } }] },
  });
  if (existing) {
    console.log(`${opts.title}: already exists`);
    return;
  }
  const igdb = await igdbBySlug(opts.igdbSlugs);
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
  for (const g of opts.games) {
    const platform = await prisma.platform.findUnique({ where: { slug: g.platformSlug } });
    if (!platform) continue;
    const version = await prisma.gameVersion.findUnique({
      where: { slug: g.versionSlug ?? "standard" },
    });
    const gameCover = g.coverIgdbSlugs ? coverOf(await igdbBySlug(g.coverIgdbSlugs)) : null;
    const game = await prisma.game.create({
      data: {
        gameFamilyId: family.id,
        platformId: platform.id,
        releaseDate: new Date(g.date),
        coverUrl: gameCover,
        ...(version ? { versions: { connect: [{ id: version.id }] } } : {}),
      },
    });
    if (version && g.versionSlug && g.versionSlug !== "standard") {
      await prisma.gameVersionReleaseDate.upsert({
        where: { gameId_gameVersionId: { gameId: game.id, gameVersionId: version.id } },
        update: { releaseDate: new Date(g.date) },
        create: { gameId: game.id, gameVersionId: version.id, releaseDate: new Date(g.date) },
      });
    }
  }
  console.log(`${opts.title}: created (IGDB ${igdb ? igdb.slug : "not found"})`);
}

async function main() {
  console.log("=== Final Fantasy series pass ===\n");

  await createFamily({
    title: "Final Fantasy II",
    slug: "final-fantasy-ii",
    igdbSlugs: ["final-fantasy-ii"],
    familyDate: "1988-12-17",
    games: [{ platformSlug: "nes", date: "1988-12-17" }],
  });

  await createFamily({
    title: "Final Fantasy IV",
    slug: "final-fantasy-iv",
    igdbSlugs: ["final-fantasy-iv"],
    familyDate: "1991-11-23",
    games: [
      { platformSlug: "snes", date: "1991-11-23" },
      {
        platformSlug: "nds",
        date: "2008-07-22",
        versionSlug: "remake",
        coverIgdbSlugs: ["final-fantasy-iv-3d-remake", "final-fantasy-iv--1"],
      },
    ],
  });

  await createFamily({
    title: "Final Fantasy V",
    slug: "final-fantasy-v",
    igdbSlugs: ["final-fantasy-v"],
    familyDate: "1992-12-06",
    games: [{ platformSlug: "snes", date: "1992-12-06" }],
  });

  await createFamily({
    title: "Final Fantasy VII",
    slug: "final-fantasy-vii",
    igdbSlugs: ["final-fantasy-vii"],
    familyDate: "1997-09-07",
    games: [
      { platformSlug: "ps1", date: "1997-09-07" },
      { platformSlug: "ps4", date: "2015-12-05" },
      { platformSlug: "switch", date: "2019-03-26" },
      { platformSlug: "xbox-one", date: "2019-03-26" },
    ],
  });

  // FFXIII-2: xbox-one row is BC only; the real platforms are PS3/X360
  const xiii2 = await prisma.gameFamily.findFirst({
    where: { title: { equals: "Final Fantasy XIII-2", mode: "insensitive" } },
    include: { games: { include: { platform: true } } },
  });
  if (xiii2) {
    const wrongRow = xiii2.games.find((g) => g.platform?.slug === "xbox-one");
    const x360 = await prisma.platform.findUnique({ where: { slug: "xbox-360" } });
    if (wrongRow && x360 && !xiii2.games.some((g) => g.platform?.slug === "xbox-360")) {
      await prisma.game.update({ where: { id: wrongRow.id }, data: { platformId: x360.id } });
      console.log("FFXIII-2: xbox-one row moved to xbox-360");
    }
    const ps3 = await prisma.platform.findUnique({ where: { slug: "ps3" } });
    const standard = await prisma.gameVersion.findUnique({ where: { slug: "standard" } });
    if (ps3 && !xiii2.games.some((g) => g.platform?.slug === "ps3")) {
      await prisma.game.create({
        data: {
          gameFamilyId: xiii2.id,
          platformId: ps3.id,
          releaseDate: new Date("2012-01-31"),
          ...(standard ? { versions: { connect: [{ id: standard.id }] } } : {}),
        },
      });
      console.log("FFXIII-2: ps3 entry created");
    }
  }

  // FFXV never shipped on Switch
  const xvSwitch = await prisma.game.findFirst({
    where: {
      gameFamily: { title: { equals: "Final Fantasy XV", mode: "insensitive" } },
      platform: { slug: "switch" },
    },
    include: {
      _count: { select: { userGames: true, collectionItems: true, trophies: true, buylistItems: true } },
    },
  });
  if (xvSwitch) {
    const c = xvSwitch._count;
    if (c.userGames + c.collectionItems + c.trophies + c.buylistItems === 0) {
      await prisma.game.delete({ where: { id: xvSwitch.id } });
      console.log("FFXV: phantom switch entry removed");
    } else {
      console.log("FFXV switch: has user data, kept");
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
