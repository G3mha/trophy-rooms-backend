/**
 * Alone in the Dark series pass (2026-07-22).
 *
 * - The seeded plain "Alone in the Dark" family is the 2008 game: renamed
 *   to "Alone in the Dark (2008)", NA date fixed, missing platforms added
 *   (Wii/PS2/PC), and the enhanced PS3 release linked as an "Inferno"
 *   version (2008-11-18)
 * - Create the 1992 original as the plain-title family (PC)
 * - Create Alone in the Dark 3 (PC), Illumination (Steam 2015),
 *   and Alone in the Dark (2024) (PS5/XSX/Steam 2024-03-20)
 * - AitD 2: add the missing PC original (1993); the PS1/Saturn entries are
 *   the 1996 NA ports (One-Eyed Jack's Revenge) - dates fixed from IGDB
 * - The New Nightmare: NA date on PS1 (2001-06-19), add the PC release
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

async function addGame(
  familyId: string,
  platformSlug: string,
  date: Date,
  label: string,
  versionSlug: string | null = "standard"
) {
  const platform = await prisma.platform.findUnique({ where: { slug: platformSlug } });
  if (!platform) {
    console.log(`${label}: platform missing`);
    return;
  }
  const existing = await prisma.game.findFirst({
    where: { gameFamilyId: familyId, platformId: platform.id },
  });
  if (existing) {
    console.log(`${label}: already exists`);
    return;
  }
  const version = versionSlug
    ? await prisma.gameVersion.findUnique({ where: { slug: versionSlug } })
    : null;
  await prisma.game.create({
    data: {
      gameFamilyId: familyId,
      platformId: platform.id,
      releaseDate: date,
      ...(version ? { versions: { connect: [{ id: version.id }] } } : {}),
    },
  });
  console.log(`${label}: created`);
}

async function createFamilyWithGames(opts: {
  title: string;
  slug: string;
  igdbLookup: () => Promise<IGDBGame | null>;
  fallbackDate: string;
  platforms: string[];
  useIgdbDate?: boolean;
}) {
  const existing = await prisma.gameFamily.findFirst({
    where: { OR: [{ slug: opts.slug }, { title: { equals: opts.title, mode: "insensitive" } }] },
  });
  if (existing) {
    console.log(`${opts.title}: already exists`);
    return;
  }
  const igdb = await opts.igdbLookup();
  const date =
    opts.useIgdbDate && igdb?.first_release_date
      ? new Date(igdb.first_release_date * 1000)
      : new Date(opts.fallbackDate);
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
  for (const slug of opts.platforms) {
    await addGame(family.id, slug, date, `${opts.title} ${slug}`);
  }
  console.log(`${opts.title}: created (IGDB ${igdb ? igdb.slug : "not found"})`);
}

async function main() {
  console.log("=== Alone in the Dark series pass ===\n");

  // --- The seeded plain-title family is the 2008 game: rename it ---
  const aitd2008 = await prisma.gameFamily.findFirst({
    where: { title: { equals: "Alone in the Dark", mode: "insensitive" } },
    include: { games: { include: { platform: true } } },
  });
  if (aitd2008 && aitd2008.games.some((g) => g.releaseDate?.toISOString().startsWith("2008"))) {
    await prisma.gameFamily.update({
      where: { id: aitd2008.id },
      data: {
        title: "Alone in the Dark (2008)",
        slug: "alone-in-the-dark-2008",
        searchTitle: normalizeForSearch("Alone in the Dark (2008)"),
      },
    });
    console.log("Seeded family renamed to Alone in the Dark (2008)");

    const x360 = aitd2008.games.find((g) => g.platform?.slug === "xbox-360");
    if (x360 && x360.releaseDate?.toISOString().startsWith("2008-06-20")) {
      await prisma.game.update({
        where: { id: x360.id },
        data: { releaseDate: new Date("2008-06-24") },
      });
      console.log("2008 xbox-360: NA date set");
    }
    for (const slug of ["wii", "ps2", "pc"]) {
      await addGame(aitd2008.id, slug, new Date("2008-06-24"), `2008 ${slug}`);
    }

    // Enhanced PS3 release: Inferno
    let inferno = await prisma.gameVersion.findUnique({ where: { slug: "inferno" } });
    if (!inferno) {
      inferno = await prisma.gameVersion.create({
        data: {
          name: "Inferno",
          slug: "inferno",
          description:
            "Enhanced PS3 release of Alone in the Dark (2008) with reworked controls and driving sequences.",
          releaseDate: new Date("2008-11-18"),
          isDefault: false,
        },
      });
      console.log("Created version: Inferno");
    }
    await addGame(aitd2008.id, "ps3", new Date("2008-11-18"), "2008 ps3 (Inferno)", null);
    const refreshed = await prisma.game.findFirst({
      where: { gameFamilyId: aitd2008.id, platform: { slug: "ps3" } },
      include: { versions: true },
    });
    if (refreshed && !refreshed.versions.some((v) => v.id === inferno.id)) {
      await prisma.game.update({
        where: { id: refreshed.id },
        data: { versions: { connect: [{ id: inferno.id }] } },
      });
      console.log("Inferno version linked to ps3");
    }
  } else {
    console.log("Plain-title family is not the 2008 game, skipping rename");
  }

  // --- The 1992 original reclaims the plain title ---
  await createFamilyWithGames({
    title: "Alone in the Dark",
    slug: "alone-in-the-dark-1992",
    igdbLookup: () => igdbExact("Alone in the Dark", 1992),
    fallbackDate: "1992-12-31",
    platforms: ["pc"],
    useIgdbDate: true,
  });

  // --- AitD 2: PC original + NA port dates from IGDB ---
  const aitd2 = await prisma.gameFamily.findFirst({
    where: { title: { equals: "Alone in the Dark 2", mode: "insensitive" } },
    include: { games: { include: { platform: true } } },
  });
  if (aitd2) {
    await addGame(aitd2.id, "pc", new Date("1993-12-31"), "AitD 2 pc");
    const oejr = await igdbBySlug("alone-in-the-dark-one-eyed-jacks-revenge");
    const portDate = oejr?.first_release_date
      ? new Date(oejr.first_release_date * 1000)
      : new Date("1996-07-31");
    for (const slug of ["ps1", "saturn"]) {
      const game = aitd2.games.find((g) => g.platform?.slug === slug);
      if (game && game.releaseDate?.toISOString().startsWith("1993")) {
        await prisma.game.update({
          where: { id: game.id },
          data: { releaseDate: portDate },
        });
        console.log(`AitD 2 ${slug}: date -> ${portDate.toISOString().split("T")[0]} (One-Eyed Jack's Revenge port)`);
      }
    }
  }

  // --- AitD 3 ---
  await createFamilyWithGames({
    title: "Alone in the Dark 3",
    slug: "alone-in-the-dark-3",
    igdbLookup: () => igdbExact("Alone in the Dark 3", 1994),
    fallbackDate: "1995-02-28",
    platforms: ["pc"],
    useIgdbDate: true,
  });

  // --- The New Nightmare: NA date + PC ---
  const tnn = await prisma.gameFamily.findFirst({
    where: { title: { equals: "Alone in the Dark: The New Nightmare", mode: "insensitive" } },
    include: { games: { include: { platform: true } } },
  });
  if (tnn) {
    const ps1 = tnn.games.find((g) => g.platform?.slug === "ps1");
    if (ps1 && ps1.releaseDate?.toISOString().startsWith("2001-05")) {
      await prisma.game.update({
        where: { id: ps1.id },
        data: { releaseDate: new Date("2001-06-19") },
      });
      console.log("New Nightmare ps1: NA date set");
    }
    await addGame(tnn.id, "pc", new Date("2001-06-19"), "New Nightmare pc");
  }

  // --- Illumination + the 2024 reboot ---
  await createFamilyWithGames({
    title: "Alone in the Dark: Illumination",
    slug: "alone-in-the-dark-illumination",
    igdbLookup: () => igdbExact("Alone in the Dark: Illumination", 2015),
    fallbackDate: "2015-06-11",
    platforms: ["steam"],
  });
  await createFamilyWithGames({
    title: "Alone in the Dark (2024)",
    slug: "alone-in-the-dark-2024",
    igdbLookup: () => igdbExact("Alone in the Dark", 2024),
    fallbackDate: "2024-03-20",
    platforms: ["ps5", "xbox-series", "steam"],
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
