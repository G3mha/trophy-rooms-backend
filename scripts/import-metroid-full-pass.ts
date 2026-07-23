/**
 * Full Metroid franchise pass (2026-07-22).
 *
 * - Create missing families: Metroid (NES + Wii/Wii U VC), Metroid: Samus
 *   Returns (3DS), Metroid Dread (Switch)
 * - Metroid Prime Trilogy bundle (COLLECTION, Wii retail 2009-08-24 + Wii U
 *   eShop 2015-01-29) with per-family Games on both platforms
 * - Metroid Prime 4: Beyond switch-2 entry gets the official "Nintendo
 *   Switch 2 Edition" version instead of Standard
 * - Fix Virtual Console dates that carried the original release dates
 *   (Super Metroid Wii/Wii U, Fusion Wii U + 3DS Ambassador, Zero Mission
 *   Wii U, Classic NES Series: Metroid GBA)
 */

import { PrismaClient, BundleType } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

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

function coverOf(game: IGDBGame | null): string | null {
  return game?.cover?.image_id
    ? getCoverUrl(game.cover.image_id, "cover_big")
    : null;
}

async function platformId(slug: string): Promise<string | null> {
  const p = await prisma.platform.findUnique({ where: { slug } });
  return p?.id ?? null;
}

async function findFamily(title: string) {
  return prisma.gameFamily.findFirst({
    where: { title: { equals: title, mode: "insensitive" } },
    include: { games: { include: { platform: true, versions: true } } },
  });
}

async function ensureGame(opts: {
  familyId: string;
  platformSlug: string;
  date: string;
  versionId?: string;
  coverUrl?: string | null;
  label: string;
}) {
  const pid = await platformId(opts.platformSlug);
  if (!pid) {
    console.log(`${opts.label}: platform missing, skipped`);
    return;
  }
  const existing = await prisma.game.findFirst({
    where: { gameFamilyId: opts.familyId, platformId: pid },
  });
  if (existing) {
    console.log(`${opts.label}: already exists`);
    return;
  }
  await prisma.game.create({
    data: {
      gameFamilyId: opts.familyId,
      platformId: pid,
      releaseDate: new Date(opts.date),
      coverUrl: opts.coverUrl ?? null,
      ...(opts.versionId
        ? { versions: { connect: [{ id: opts.versionId }] } }
        : {}),
    },
  });
  console.log(`${opts.label}: created`);
}

async function fixGameDate(familyTitle: string, platformSlug: string, date: string) {
  const game = await prisma.game.findFirst({
    where: {
      gameFamily: { title: { equals: familyTitle, mode: "insensitive" } },
      platform: { slug: platformSlug },
    },
  });
  if (!game) {
    console.log(`${familyTitle} ${platformSlug}: not found`);
    return;
  }
  const target = new Date(date);
  if (game.releaseDate?.getTime() === target.getTime()) {
    console.log(`${familyTitle} ${platformSlug}: already ${date}`);
    return;
  }
  await prisma.game.update({ where: { id: game.id }, data: { releaseDate: target } });
  console.log(`${familyTitle} ${platformSlug}: date -> ${date}`);
}

async function main() {
  console.log("=== Metroid full pass ===\n");

  const standard = await prisma.gameVersion.findUnique({ where: { slug: "standard" } });
  if (!standard) {
    console.error("Standard version missing");
    return;
  }

  // --- Missing families ---
  const newFamilies: Array<{
    title: string;
    slug: string;
    igdbSlug: string;
    familyDate: string;
    games: Array<{ platformSlug: string; date: string; standard: boolean }>;
  }> = [
    {
      title: "Metroid",
      slug: "metroid",
      igdbSlug: "metroid",
      familyDate: "1987-08-15",
      games: [
        { platformSlug: "nes", date: "1987-08-15", standard: true },
        { platformSlug: "wii", date: "2007-08-13", standard: true },
        { platformSlug: "wii-u", date: "2013-07-11", standard: true },
      ],
    },
    {
      title: "Metroid: Samus Returns",
      slug: "metroid-samus-returns",
      igdbSlug: "metroid-samus-returns",
      familyDate: "2017-09-15",
      games: [{ platformSlug: "3ds", date: "2017-09-15", standard: true }],
    },
    {
      title: "Metroid Dread",
      slug: "metroid-dread",
      igdbSlug: "metroid-dread",
      familyDate: "2021-10-08",
      games: [{ platformSlug: "switch", date: "2021-10-08", standard: true }],
    },
  ];

  for (const nf of newFamilies) {
    const existing = await prisma.gameFamily.findFirst({
      where: {
        OR: [{ slug: nf.slug }, { title: { equals: nf.title, mode: "insensitive" } }],
      },
    });
    if (existing) {
      console.log(`${nf.title}: family already exists`);
      continue;
    }
    const igdb = await igdbBySlug(nf.igdbSlug);
    const family = await prisma.gameFamily.create({
      data: {
        title: nf.title,
        slug: nf.slug,
        description: igdb?.summary || null,
        coverUrl: coverOf(igdb),
        releaseDate: new Date(nf.familyDate),
      },
    });
    console.log(`Created family: ${nf.title}`);
    for (const g of nf.games) {
      await ensureGame({
        familyId: family.id,
        platformSlug: g.platformSlug,
        date: g.date,
        versionId: g.standard ? standard.id : undefined,
        label: `${nf.title} ${g.platformSlug}`,
      });
    }
  }

  // --- Metroid Prime Trilogy bundle ---
  const prime1 = await findFamily("Metroid Prime");
  const prime2 = await findFamily("Metroid Prime 2: Echoes");
  const prime3 = await findFamily("Metroid Prime 3: Corruption");
  const trilogyIgdb = await igdbBySlug("metroid-prime-trilogy");
  const trilogyCover = coverOf(trilogyIgdb);

  if (prime1 && prime2 && prime3) {
    // Compilation-only Games on the bundle's platforms (no standalone versions)
    await ensureGame({ familyId: prime1.id, platformSlug: "wii", date: "2009-08-24", coverUrl: trilogyCover, label: "Prime wii (Trilogy)" });
    await ensureGame({ familyId: prime2.id, platformSlug: "wii", date: "2009-08-24", coverUrl: trilogyCover, label: "Prime 2 wii (Trilogy)" });
    await ensureGame({ familyId: prime1.id, platformSlug: "wii-u", date: "2015-01-29", coverUrl: trilogyCover, label: "Prime wii-u (Trilogy)" });
    await ensureGame({ familyId: prime2.id, platformSlug: "wii-u", date: "2015-01-29", coverUrl: trilogyCover, label: "Prime 2 wii-u (Trilogy)" });
    await ensureGame({ familyId: prime3.id, platformSlug: "wii-u", date: "2015-01-29", coverUrl: trilogyCover, label: "Prime 3 wii-u (Trilogy)" });

    const existingBundle = await prisma.bundle.findUnique({
      where: { slug: "metroid-prime-trilogy" },
    });
    if (!existingBundle) {
      const wiiId = await platformId("wii");
      const wiiUId = await platformId("wii-u");
      await prisma.bundle.create({
        data: {
          name: "Metroid Prime Trilogy",
          slug: "metroid-prime-trilogy",
          type: BundleType.COLLECTION,
          description: trilogyIgdb?.summary || null,
          coverUrl: trilogyCover,
          releaseDate: new Date("2009-08-24"),
          platforms: {
            connect: [wiiId, wiiUId]
              .filter((id): id is string => Boolean(id))
              .map((id) => ({ id })),
          },
          gameFamilies: {
            connect: [prime1.id, prime2.id, prime3.id].map((id) => ({ id })),
          },
        },
      });
      console.log("Created bundle: Metroid Prime Trilogy");
    } else {
      console.log("Metroid Prime Trilogy bundle already exists");
    }
  }

  // --- Prime 4 switch-2: official Nintendo Switch 2 Edition version ---
  const s2Edition =
    (await prisma.gameVersion.findUnique({ where: { slug: "nintendo-switch-2-edition" } })) ??
    (await prisma.gameVersion.create({
      data: {
        name: "Nintendo Switch 2 Edition",
        slug: "nintendo-switch-2-edition",
        isDefault: false,
      },
    }));

  const mp4 = await findFamily("Metroid Prime 4: Beyond");
  const mp4S2 = mp4?.games.find((g) => g.platform?.slug === "switch-2");
  if (mp4S2) {
    const hasEdition = mp4S2.versions.some((v) => v.id === s2Edition.id);
    if (!hasEdition) {
      await prisma.game.update({
        where: { id: mp4S2.id },
        data: {
          versions: {
            connect: [{ id: s2Edition.id }],
            disconnect: [{ id: standard.id }],
          },
        },
      });
      console.log("Prime 4 switch-2: relinked to Nintendo Switch 2 Edition");
    } else {
      console.log("Prime 4 switch-2: edition already linked");
    }
  }

  // --- Virtual Console / re-release date fixes ---
  console.log("");
  await fixGameDate("Super Metroid", "wii", "2007-08-20");
  await fixGameDate("Super Metroid", "wii-u", "2013-05-15");
  await fixGameDate("Metroid Fusion", "wii-u", "2014-04-03");
  await fixGameDate("Metroid Fusion", "3ds", "2011-12-16");
  await fixGameDate("Metroid: Zero Mission", "wii-u", "2016-01-14");
  await fixGameDate("Classic NES Series: Metroid", "gba", "2004-10-25");
  await fixGameDate("Metroid II: Return of Samus", "3ds", "2011-11-24");
  await fixGameDate("Metroid Prime Hunters", "wii-u", "2016-06-02");
  await fixGameDate("Metroid: Other M", "wii-u", "2016-12-08");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
