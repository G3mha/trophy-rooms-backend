/**
 * Import The Thing (2002, PS2/Xbox) and The Thing: Remastered (Nightdive,
 * 2024-12-05, PS4/PS5/XB1/XSX/Switch/PC) - both were missing entirely.
 * The remaster carries a distinct title, so it gets its own family.
 */

import { PrismaClient } from "@prisma/client";
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
      coverUrl: igdb?.cover?.image_id ? getCoverUrl(igdb.cover.image_id, "cover_big") : null,
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
  console.log("=== Import The Thing + Remastered ===\n");

  await createFamilyWithGames({
    title: "The Thing",
    slug: "the-thing-2002",
    igdbName: "The Thing",
    igdbYear: 2002,
    date: "2002-09-09",
    platforms: ["ps2", "xbox"],
  });
  await createFamilyWithGames({
    title: "The Thing: Remastered",
    slug: "the-thing-remastered",
    igdbName: "The Thing: Remastered",
    igdbYear: 2024,
    date: "2024-12-05",
    platforms: ["ps4", "ps5", "xbox-one", "xbox-series", "switch", "steam"],
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
