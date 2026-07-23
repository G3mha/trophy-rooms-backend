/**
 * TMNT: The Cowabunga Collection pass (2026-07-22).
 *
 * Creates the missing classic families - Teenage Mutant Ninja Turtles
 * (NES 1989), TMNT II: The Arcade Game (NES 1990), TMNT IV: Turtles in
 * Time (SNES 1992) - adds the NES/Genesis Tournament Fighters platform
 * entries, then creates the Cowabunga Collection COLLECTION bundle
 * (2022-08-30, PS4/PS5/XB1/XSX/Switch/PC) over the nine console/handheld
 * member families. The two arcade originals have no ownable standalone
 * release (no arcade platform is tracked), so they are represented only
 * through the collection itself.
 *
 * Retro many-game collections follow the bundle-only pattern (like
 * Kirby's Dream Collection): no per-family Games on the modern platforms.
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

async function main() {
  console.log("=== Cowabunga Collection pass ===\n");

  const standard = await prisma.gameVersion.findUnique({ where: { slug: "standard" } });

  // --- Missing classic families ---
  const newFamilies = [
    {
      title: "Teenage Mutant Ninja Turtles",
      slug: "teenage-mutant-ninja-turtles-nes",
      igdbName: "Teenage Mutant Ninja Turtles",
      igdbYear: 1989,
      fallbackDate: "1989-05-12",
      platformSlug: "nes",
    },
    {
      title: "Teenage Mutant Ninja Turtles II: The Arcade Game",
      slug: "tmnt-ii-the-arcade-game",
      igdbName: "Teenage Mutant Ninja Turtles II: The Arcade Game",
      igdbYear: 1990,
      fallbackDate: "1990-04-01",
      platformSlug: "nes",
    },
    {
      title: "Teenage Mutant Ninja Turtles IV: Turtles in Time",
      slug: "tmnt-iv-turtles-in-time",
      igdbName: "Teenage Mutant Ninja Turtles IV: Turtles in Time",
      igdbYear: 1992,
      fallbackDate: "1992-08-01",
      platformSlug: "snes",
    },
  ];

  for (const nf of newFamilies) {
    const existing = await prisma.gameFamily.findFirst({
      where: { OR: [{ slug: nf.slug }, { title: { equals: nf.title, mode: "insensitive" } }] },
    });
    if (existing) {
      console.log(`${nf.title}: already exists`);
      continue;
    }
    const igdb = await igdbExact(nf.igdbName, nf.igdbYear);
    const date = igdb?.first_release_date
      ? new Date(igdb.first_release_date * 1000)
      : new Date(nf.fallbackDate);
    const family = await prisma.gameFamily.create({
      data: {
        title: nf.title,
        slug: nf.slug,
        searchTitle: normalizeForSearch(nf.title),
        description: igdb?.summary || null,
        coverUrl: coverOf(igdb),
        releaseDate: date,
      },
    });
    const platform = await prisma.platform.findUnique({ where: { slug: nf.platformSlug } });
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
    console.log(`${nf.title}: created (IGDB ${igdb ? igdb.slug : "not found"})`);
  }

  // --- Tournament Fighters NES/Genesis platform entries ---
  const tf = await prisma.gameFamily.findFirst({
    where: { title: { equals: "Teenage Mutant Ninja Turtles: Tournament Fighters", mode: "insensitive" } },
    include: { games: { include: { platform: true } } },
  });
  if (tf) {
    for (const [slug, date] of [
      ["nes", "1994-02-01"],
      ["genesis", "1993-12-01"],
    ] as const) {
      if (tf.games.some((g) => g.platform?.slug === slug)) {
        console.log(`Tournament Fighters ${slug}: already exists`);
        continue;
      }
      const platform = await prisma.platform.findUnique({ where: { slug } });
      if (!platform) continue;
      await prisma.game.create({
        data: {
          gameFamilyId: tf.id,
          platformId: platform.id,
          releaseDate: new Date(date),
          ...(standard ? { versions: { connect: [{ id: standard.id }] } } : {}),
        },
      });
      console.log(`Tournament Fighters ${slug}: created`);
    }
  }

  // --- The Cowabunga Collection bundle ---
  const bundleSlug = "tmnt-the-cowabunga-collection";
  const existingBundle = await prisma.bundle.findUnique({ where: { slug: bundleSlug } });
  if (existingBundle) {
    console.log("Cowabunga Collection bundle already exists");
    return;
  }

  const memberTitles = [
    "Teenage Mutant Ninja Turtles",
    "Teenage Mutant Ninja Turtles II: The Arcade Game",
    "Teenage Mutant Ninja Turtles III: The Manhattan Project",
    "Teenage Mutant Ninja Turtles: Tournament Fighters",
    "Teenage Mutant Ninja Turtles IV: Turtles in Time",
    "Teenage Mutant Ninja Turtles: The HyperStone Heist",
    "Teenage Mutant Ninja Turtles: Fall of the Foot Clan",
    "Teenage Mutant Ninja Turtles II: Back from the Sewers",
    "Teenage Mutant Ninja Turtles III: Radical Rescue",
  ];
  const members = await prisma.gameFamily.findMany({
    where: {
      OR: memberTitles.map((t) => ({ title: { equals: t, mode: "insensitive" as const } })),
    },
    select: { id: true, title: true },
  });
  if (members.length !== memberTitles.length) {
    const found = new Set(members.map((m) => m.title.toLowerCase()));
    console.error(
      "Missing members:",
      memberTitles.filter((t) => !found.has(t.toLowerCase())).join(", ")
    );
    return;
  }

  const platformIds: string[] = [];
  for (const slug of ["ps4", "ps5", "xbox-one", "xbox-series", "switch", "steam"]) {
    const p = await prisma.platform.findUnique({ where: { slug } });
    if (p) platformIds.push(p.id);
  }

  const igdb = await igdbExact("Teenage Mutant Ninja Turtles: The Cowabunga Collection", 2022);
  await prisma.bundle.create({
    data: {
      name: "Teenage Mutant Ninja Turtles: The Cowabunga Collection",
      slug: bundleSlug,
      type: BundleType.COLLECTION,
      description: igdb?.summary || null,
      coverUrl: coverOf(igdb),
      releaseDate: new Date("2022-08-30"),
      platforms: { connect: platformIds.map((id) => ({ id })) },
      gameFamilies: { connect: members.map((m) => ({ id: m.id })) },
    },
  });
  console.log("Created bundle: The Cowabunga Collection (9 member families)");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
