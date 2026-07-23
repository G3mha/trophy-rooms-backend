/**
 * Resident Evil franchise pass (2026-07-22).
 *
 * - Fix the original Resident Evil family: PS1/GC dates, GC "Remake"
 *   version, PS1 Director's Cut, HD Remaster platforms (2015 + Switch 2019)
 * - RE Zero HD Remaster platforms (2016 + Switch 2019)
 * - RE2/RE3 originals: fix GC port dates (2003-01-14), RE3 Dreamcast (2000)
 * - New families: RE2 (2019), RE3 (2020), RE4 (2023) remakes with their
 *   platforms, cloud versions, and RE4 Gold Edition; Resident Evil 6;
 *   Outbreak File #2
 * - RE4 (2005) later ports (PS3/X360 2011, PS4/XB1 2016, Switch 2019)
 * - RE5 Gold Edition + modern ports; Revelations console/modern ports;
 *   Revelations 2 date fixes + PS3/X360
 * - Code Veronica X (PS2/GC) and HD (PS3/X360)
 * - Origins Collection bundle (RE + RE Zero, PS4/XB1 2016-01-19)
 */

import { PrismaClient, BundleType } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

async function igdbSearchByYear(name: string, year: number): Promise<IGDBGame | null> {
  try {
    const results = await igdbRequest<IGDBGame[]>(
      "games",
      `fields id, name, slug, summary, cover.image_id, first_release_date;
       search "${name}"; limit 10;`
    );
    return (
      results.find(
        (g) =>
          g.first_release_date &&
          new Date(g.first_release_date * 1000).getFullYear() === year &&
          g.name.toLowerCase().startsWith(name.toLowerCase())
      ) ?? null
    );
  } catch {
    return null;
  }
}

function coverOf(game: IGDBGame | null): string | null {
  return game?.cover?.image_id ? getCoverUrl(game.cover.image_id, "cover_big") : null;
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

async function version(slug: string, name: string) {
  const existing = await prisma.gameVersion.findUnique({ where: { slug } });
  if (existing) return existing;
  const v = await prisma.gameVersion.create({ data: { slug, name, isDefault: false } });
  console.log(`Created version: ${name}`);
  return v;
}

async function override(gameId: string, versionId: string, date: string) {
  await prisma.gameVersionReleaseDate.upsert({
    where: { gameId_gameVersionId: { gameId, gameVersionId: versionId } },
    update: { releaseDate: new Date(date) },
    create: { gameId, gameVersionId: versionId, releaseDate: new Date(date) },
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
    include: { versions: true },
  });
  if (existing) {
    if (opts.versionId && !existing.versions.some((v) => v.id === opts.versionId)) {
      await prisma.game.update({
        where: { id: existing.id },
        data: { versions: { connect: [{ id: opts.versionId }] } },
      });
      await override(existing.id, opts.versionId, opts.date);
      console.log(`${opts.label}: version linked to existing game`);
    } else {
      console.log(`${opts.label}: already exists`);
    }
    return;
  }
  const game = await prisma.game.create({
    data: {
      gameFamilyId: opts.familyId,
      platformId: pid,
      releaseDate: new Date(opts.date),
      coverUrl: opts.coverUrl ?? null,
      ...(opts.versionId ? { versions: { connect: [{ id: opts.versionId }] } } : {}),
    },
  });
  if (opts.versionId) await override(game.id, opts.versionId, opts.date);
  console.log(`${opts.label}: created`);
}

async function fixDate(familyTitle: string, platformSlug: string, date: string) {
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
  if (game.releaseDate?.getTime() === target.getTime()) return;
  await prisma.game.update({ where: { id: game.id }, data: { releaseDate: target } });
  console.log(`${familyTitle} ${platformSlug}: date -> ${date}`);
}

async function createFamily(opts: {
  title: string;
  slug: string;
  igdbName: string;
  igdbYear: number;
  familyDate: string;
}) {
  const existing = await prisma.gameFamily.findFirst({
    where: { OR: [{ slug: opts.slug }, { title: { equals: opts.title, mode: "insensitive" } }] },
  });
  if (existing) {
    console.log(`${opts.title}: family already exists`);
    return existing;
  }
  const igdb = await igdbSearchByYear(opts.igdbName, opts.igdbYear);
  const family = await prisma.gameFamily.create({
    data: {
      title: opts.title,
      slug: opts.slug,
      description: igdb?.summary || null,
      coverUrl: coverOf(igdb),
      releaseDate: new Date(opts.familyDate),
    },
  });
  console.log(`Created family: ${opts.title}`);
  return family;
}

async function main() {
  console.log("=== Resident Evil franchise pass ===\n");

  const standard = await version("standard", "Standard");
  const directorsCut = await version("directors-cut", "Director's Cut");
  const goldEdition = await version("gold-edition", "Gold Edition");
  const cloudVersion = await version("cloud-version", "Cloud Version");
  const remake = await version("remake", "Remake");
  const hdRemaster = await version("hd-remaster", "HD Remaster");

  // --- Resident Evil (1996 / 2002 remake / HD Remaster) ---
  const re1 = await findFamily("Resident Evil");
  if (re1) {
    await fixDate("Resident Evil", "ps1", "1996-03-30");
    await fixDate("Resident Evil", "gamecube", "2002-04-30");
    const gc = re1.games.find((g) => g.platform?.slug === "gamecube");
    if (gc && !gc.versions.some((v) => v.id === remake.id)) {
      await prisma.game.update({
        where: { id: gc.id },
        data: { versions: { connect: [{ id: remake.id }] } },
      });
      await override(gc.id, remake.id, "2002-04-30");
      console.log("RE gamecube: Remake version linked");
    }
    const ps1 = re1.games.find((g) => g.platform?.slug === "ps1");
    if (ps1 && !ps1.versions.some((v) => v.id === directorsCut.id)) {
      await prisma.game.update({
        where: { id: ps1.id },
        data: { versions: { connect: [{ id: directorsCut.id }] } },
      });
      await override(ps1.id, directorsCut.id, "1997-09-30");
      console.log("RE ps1: Director's Cut version linked");
    }
    for (const [slug, date] of [
      ["ps3", "2015-01-20"], ["xbox-360", "2015-01-20"],
      ["ps4", "2015-01-20"], ["xbox-one", "2015-01-20"],
      ["switch", "2019-05-21"],
    ] as const) {
      await ensureGame({
        familyId: re1.id, platformSlug: slug, date,
        versionId: hdRemaster.id, label: `RE HD Remaster ${slug}`,
      });
    }
  }

  // --- Resident Evil Zero HD ---
  const re0 = await findFamily("Resident Evil Zero");
  if (re0) {
    for (const [slug, date] of [
      ["ps3", "2016-01-19"], ["xbox-360", "2016-01-19"],
      ["ps4", "2016-01-19"], ["xbox-one", "2016-01-19"],
      ["switch", "2019-05-21"],
    ] as const) {
      await ensureGame({
        familyId: re0.id, platformSlug: slug, date,
        versionId: hdRemaster.id, label: `RE0 HD ${slug}`,
      });
    }
  }

  // --- Original RE2 / RE3 port date fixes ---
  await fixDate("Resident Evil 2", "gamecube", "2003-01-14");
  await fixDate("Resident Evil 3: Nemesis", "gamecube", "2003-01-14");
  await fixDate("Resident Evil 3: Nemesis", "dreamcast", "2000-11-16");

  // --- Remake families ---
  const re2r = await createFamily({
    title: "Resident Evil 2 (2019)",
    slug: "resident-evil-2-2019",
    igdbName: "Resident Evil 2",
    igdbYear: 2019,
    familyDate: "2019-01-25",
  });
  for (const [slug, date, vid] of [
    ["ps4", "2019-01-25", standard.id], ["xbox-one", "2019-01-25", standard.id],
    ["steam", "2019-01-25", standard.id],
    ["ps5", "2022-06-13", standard.id], ["xbox-series", "2022-06-13", standard.id],
    ["switch", "2022-11-11", cloudVersion.id],
    ["ios", "2024-12-10", standard.id], ["macos", "2024-12-10", standard.id],
  ] as const) {
    await ensureGame({ familyId: re2r.id, platformSlug: slug, date, versionId: vid, label: `RE2R ${slug}` });
  }

  const re3r = await createFamily({
    title: "Resident Evil 3 (2020)",
    slug: "resident-evil-3-2020",
    igdbName: "Resident Evil 3",
    igdbYear: 2020,
    familyDate: "2020-04-03",
  });
  for (const [slug, date, vid] of [
    ["ps4", "2020-04-03", standard.id], ["xbox-one", "2020-04-03", standard.id],
    ["steam", "2020-04-03", standard.id],
    ["ps5", "2022-06-13", standard.id], ["xbox-series", "2022-06-13", standard.id],
    ["switch", "2022-11-18", cloudVersion.id],
  ] as const) {
    await ensureGame({ familyId: re3r.id, platformSlug: slug, date, versionId: vid, label: `RE3R ${slug}` });
  }

  const re4r = await createFamily({
    title: "Resident Evil 4 (2023)",
    slug: "resident-evil-4-2023",
    igdbName: "Resident Evil 4",
    igdbYear: 2023,
    familyDate: "2023-03-24",
  });
  for (const [slug, date, vid] of [
    ["ps4", "2023-03-24", standard.id], ["ps5", "2023-03-24", standard.id],
    ["xbox-series", "2023-03-24", standard.id], ["steam", "2023-03-24", standard.id],
    ["ios", "2023-12-20", standard.id], ["macos", "2023-12-20", standard.id],
  ] as const) {
    await ensureGame({ familyId: re4r.id, platformSlug: slug, date, versionId: vid, label: `RE4R ${slug}` });
  }
  const re4rFull = await findFamily("Resident Evil 4 (2023)");
  for (const slug of ["ps4", "ps5", "xbox-series"]) {
    const game = re4rFull?.games.find((g) => g.platform?.slug === slug);
    if (game && !game.versions.some((v) => v.id === goldEdition.id)) {
      await prisma.game.update({
        where: { id: game.id },
        data: { versions: { connect: [{ id: goldEdition.id }] } },
      });
      await override(game.id, goldEdition.id, "2024-02-09");
      console.log(`RE4R Gold ${slug}: linked`);
    }
  }

  // --- RE4 (2005) later ports ---
  const re4 = await findFamily("Resident Evil 4");
  if (re4) {
    for (const [slug, date] of [
      ["ps3", "2011-09-20"], ["xbox-360", "2011-09-20"],
      ["ps4", "2016-08-30"], ["xbox-one", "2016-08-30"],
      ["switch", "2019-05-21"],
    ] as const) {
      await ensureGame({
        familyId: re4.id, platformSlug: slug, date,
        versionId: standard.id, label: `RE4 ${slug}`,
      });
    }
  }

  // --- RE5 ---
  const re5 = await findFamily("Resident Evil 5");
  if (re5) {
    for (const slug of ["ps3", "xbox-360"]) {
      const game = re5.games.find((g) => g.platform?.slug === slug);
      if (game && !game.versions.some((v) => v.id === goldEdition.id)) {
        await prisma.game.update({
          where: { id: game.id },
          data: { versions: { connect: [{ id: goldEdition.id }] } },
        });
        await override(game.id, goldEdition.id, "2010-03-09");
        console.log(`RE5 Gold ${slug}: linked`);
      }
    }
    for (const [slug, date] of [
      ["ps4", "2016-06-28"], ["xbox-one", "2016-06-28"], ["switch", "2019-10-29"],
    ] as const) {
      await ensureGame({
        familyId: re5.id, platformSlug: slug, date,
        versionId: standard.id, label: `RE5 ${slug}`,
      });
    }
  }

  // --- RE6 (missing entirely) ---
  const re6 = await createFamily({
    title: "Resident Evil 6",
    slug: "resident-evil-6",
    igdbName: "Resident Evil 6",
    igdbYear: 2012,
    familyDate: "2012-10-02",
  });
  for (const [slug, date] of [
    ["ps3", "2012-10-02"], ["xbox-360", "2012-10-02"],
    ["ps4", "2016-03-29"], ["xbox-one", "2016-03-29"], ["switch", "2019-10-29"],
  ] as const) {
    await ensureGame({
      familyId: re6.id, platformSlug: slug, date,
      versionId: standard.id, label: `RE6 ${slug}`,
    });
  }

  // --- Revelations 1/2 ---
  const rev1 = await findFamily("Resident Evil: Revelations");
  if (rev1) {
    for (const [slug, date] of [
      ["wii-u", "2013-05-21"], ["ps3", "2013-05-21"], ["xbox-360", "2013-05-21"],
      ["ps4", "2017-08-29"], ["xbox-one", "2017-08-29"], ["switch", "2017-11-28"],
    ] as const) {
      await ensureGame({
        familyId: rev1.id, platformSlug: slug, date,
        versionId: standard.id, label: `Revelations ${slug}`,
      });
    }
  }
  await fixDate("Resident Evil: Revelations 2", "vita", "2015-08-18");
  await fixDate("Resident Evil: Revelations 2", "switch", "2017-11-28");
  const rev2 = await findFamily("Resident Evil: Revelations 2");
  if (rev2) {
    for (const slug of ["ps3", "xbox-360"]) {
      await ensureGame({
        familyId: rev2.id, platformSlug: slug, date: "2015-02-24",
        versionId: standard.id, label: `Revelations 2 ${slug}`,
      });
    }
  }

  // --- Code Veronica X / HD ---
  const cv = await findFamily("Resident Evil Code: Veronica");
  if (cv) {
    for (const [slug, date] of [
      ["ps2", "2001-08-21"], ["gamecube", "2003-12-03"],
      ["ps3", "2011-09-27"], ["xbox-360", "2011-09-27"],
    ] as const) {
      await ensureGame({
        familyId: cv.id, platformSlug: slug, date,
        versionId: standard.id, label: `Code Veronica ${slug}`,
      });
    }
  }

  // --- Outbreak File #2 ---
  const of2 = await createFamily({
    title: "Resident Evil Outbreak File #2",
    slug: "resident-evil-outbreak-file-2",
    igdbName: "Resident Evil Outbreak File #2",
    igdbYear: 2005,
    familyDate: "2005-04-26",
  });
  await ensureGame({
    familyId: of2.id, platformSlug: "ps2", date: "2005-04-26",
    versionId: standard.id, label: "Outbreak File #2 ps2",
  });

  // --- Origins Collection bundle ---
  const existingBundle = await prisma.bundle.findUnique({
    where: { slug: "resident-evil-origins-collection" },
  });
  if (!existingBundle && re1 && re0) {
    const igdb = await igdbSearchByYear("Resident Evil Origins Collection", 2016);
    const ps4Id = await platformId("ps4");
    const xb1Id = await platformId("xbox-one");
    await prisma.bundle.create({
      data: {
        name: "Resident Evil Origins Collection",
        slug: "resident-evil-origins-collection",
        type: BundleType.COLLECTION,
        description: igdb?.summary || null,
        coverUrl: coverOf(igdb),
        releaseDate: new Date("2016-01-19"),
        platforms: {
          connect: [ps4Id, xb1Id].filter((id): id is string => Boolean(id)).map((id) => ({ id })),
        },
        gameFamilies: { connect: [{ id: re1.id }, { id: re0.id }] },
      },
    });
    console.log("Created bundle: Resident Evil Origins Collection");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
