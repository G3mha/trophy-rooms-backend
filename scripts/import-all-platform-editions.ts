/**
 * All-platform special editions pass, chronological (2026-07-22).
 *
 * PS2/Xbox era: SH2 Restless Dreams (Xbox), MGS2 Substance (Xbox + PS2),
 *   MGS3 family + Subsistence, DMC3 Special Edition, Persona 3 FES + Portable,
 *   Ninja Gaiden Black
 * Wii era: Resident Evil 4 family (GC/PS2) + Wii Edition
 * PS3/X360 era: GOTY editions (Oblivion, Fallout 3, Borderlands, RDR,
 *   Arkham Asylum/City), Skyrim family (+ Legendary/Special/Switch),
 *   Persona 4 Golden, FF Tactics: War of the Lions (PSP date fix + version)
 * PS4 era: The Last of Us family + Remastered, GoW III Remastered,
 *   Horizon ZD Complete Edition + Remastered, Spider-Man Remastered
 * PS5 era: Ghost of Tsushima + Death Stranding Director's Cuts,
 *   TLOU Part II Remastered (date fix), Cyberpunk Ultimate on PS5/XSX,
 *   Witcher 3 Complete on PS5/XSX, Oblivion Remastered
 */

import { PrismaClient } from "@prisma/client";
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

async function findFamily(title: string) {
  return prisma.gameFamily.findFirst({
    where: { title: { equals: title, mode: "insensitive" } },
    include: { games: { include: { platform: true, versions: true } } },
  });
}

async function platformId(slug: string): Promise<string | null> {
  const p = await prisma.platform.findUnique({ where: { slug } });
  return p?.id ?? null;
}

async function findOrCreateVersion(data: {
  slug: string;
  name: string;
  coverUrl?: string | null;
  releaseDate?: string | null;
}) {
  const existing = await prisma.gameVersion.findUnique({ where: { slug: data.slug } });
  if (existing) return existing;
  const version = await prisma.gameVersion.create({
    data: {
      slug: data.slug,
      name: data.name,
      coverUrl: data.coverUrl ?? null,
      releaseDate: data.releaseDate ? new Date(data.releaseDate) : null,
      isDefault: false,
    },
  });
  console.log(`Created version: ${version.name} (${version.slug})`);
  return version;
}

async function override(gameId: string, versionId: string, date: string) {
  await prisma.gameVersionReleaseDate.upsert({
    where: { gameId_gameVersionId: { gameId, gameVersionId: versionId } },
    update: { releaseDate: new Date(date) },
    create: { gameId, gameVersionId: versionId, releaseDate: new Date(date) },
  });
}

/** Link an edition version to an existing platform game with a date override. */
async function linkEdition(
  family: Awaited<ReturnType<typeof findFamily>>,
  platformSlug: string,
  versionId: string,
  date: string,
  label: string
) {
  const game = family?.games.find((g) => g.platform?.slug === platformSlug);
  if (!game) {
    console.log(`${label}: no ${platformSlug} game, skipped`);
    return;
  }
  if (!game.versions.some((v) => v.id === versionId)) {
    await prisma.game.update({
      where: { id: game.id },
      data: { versions: { connect: [{ id: versionId }] } },
    });
  }
  await override(game.id, versionId, date);
  console.log(`${label}: linked`);
}

/** Create a platform game carrying an edition version. */
async function addEditionGame(opts: {
  familyId: string;
  platformSlug: string;
  date: string;
  versionId: string;
  coverUrl?: string | null;
  label: string;
}) {
  const pid = await platformId(opts.platformSlug);
  if (!pid) {
    console.log(`${opts.label}: platform missing, skipped`);
    return null;
  }
  const existing = await prisma.game.findFirst({
    where: { gameFamilyId: opts.familyId, platformId: pid },
  });
  if (existing) {
    if (!(await prisma.game.findFirst({
      where: { id: existing.id, versions: { some: { id: opts.versionId } } },
    }))) {
      await prisma.game.update({
        where: { id: existing.id },
        data: { versions: { connect: [{ id: opts.versionId }] } },
      });
    }
    await override(existing.id, opts.versionId, opts.date);
    console.log(`${opts.label}: existing game, version linked`);
    return existing;
  }
  const game = await prisma.game.create({
    data: {
      gameFamilyId: opts.familyId,
      platformId: pid,
      releaseDate: new Date(opts.date),
      coverUrl: opts.coverUrl ?? null,
      versions: { connect: [{ id: opts.versionId }] },
    },
  });
  await override(game.id, opts.versionId, opts.date);
  console.log(`${opts.label}: created`);
  return game;
}

async function createFamilyWithGames(opts: {
  title: string;
  slug: string;
  igdbSlug: string;
  familyDate: string;
  games: Array<{ platformSlug: string; date: string; versionId: string }>;
}) {
  const existing = await prisma.gameFamily.findFirst({
    where: { OR: [{ slug: opts.slug }, { title: { equals: opts.title, mode: "insensitive" } }] },
  });
  if (existing) {
    console.log(`${opts.title}: family already exists`);
    return findFamily(opts.title);
  }
  const igdb = await igdbBySlug(opts.igdbSlug);
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
  for (const g of opts.games) {
    const pid = await platformId(g.platformSlug);
    if (!pid) continue;
    await prisma.game.create({
      data: {
        gameFamilyId: family.id,
        platformId: pid,
        releaseDate: new Date(g.date),
        versions: { connect: [{ id: g.versionId }] },
      },
    });
  }
  return findFamily(opts.title);
}

async function main() {
  console.log("=== All-platform special editions pass ===\n");

  const standard = await findOrCreateVersion({ slug: "standard", name: "Standard" });
  const remastered = await findOrCreateVersion({ slug: "remastered", name: "Remastered" });
  const directorsCut = await findOrCreateVersion({ slug: "directors-cut", name: "Director's Cut" });
  const completeEdition = await findOrCreateVersion({ slug: "complete-edition", name: "Complete Edition" });
  const ultimateEdition = await findOrCreateVersion({ slug: "ultimate-edition", name: "Ultimate Edition" });
  const specialEdition = await findOrCreateVersion({ slug: "special-edition", name: "Special Edition" });
  const goty = await findOrCreateVersion({ slug: "game-of-the-year-edition", name: "Game of the Year Edition" });

  // ============ PS2 / Xbox era ============
  console.log("\n--- PS2 / Xbox era ---");

  const sh2 = await findFamily("Silent Hill 2");
  if (sh2) {
    const rd = await findOrCreateVersion({ slug: "restless-dreams", name: "Restless Dreams" });
    await addEditionGame({
      familyId: sh2.id, platformSlug: "xbox", date: "2001-12-20",
      versionId: rd.id, label: "SH2 Restless Dreams xbox",
    });
  }

  const mgs2 = await findFamily("Metal Gear Solid 2: Sons of Liberty");
  if (mgs2) {
    const substanceIgdb = await igdbBySlug("metal-gear-solid-2-substance");
    const substance = await findOrCreateVersion({
      slug: "substance", name: "Substance",
      coverUrl: coverOf(substanceIgdb), releaseDate: "2002-11-04",
    });
    await addEditionGame({
      familyId: mgs2.id, platformSlug: "xbox", date: "2002-11-04",
      versionId: substance.id, coverUrl: coverOf(substanceIgdb),
      label: "MGS2 Substance xbox",
    });
    await linkEdition(mgs2, "ps2", substance.id, "2003-03-04", "MGS2 Substance ps2");
  }

  const subsistenceIgdb = await igdbBySlug("metal-gear-solid-3-subsistence");
  const subsistence = await findOrCreateVersion({
    slug: "subsistence", name: "Subsistence",
    coverUrl: coverOf(subsistenceIgdb), releaseDate: "2006-03-14",
  });
  const mgs3 = await createFamilyWithGames({
    title: "Metal Gear Solid 3: Snake Eater",
    slug: "metal-gear-solid-3-snake-eater",
    igdbSlug: "metal-gear-solid-3-snake-eater",
    familyDate: "2004-11-17",
    games: [{ platformSlug: "ps2", date: "2004-11-17", versionId: standard.id }],
  });
  if (mgs3) {
    await linkEdition(mgs3, "ps2", subsistence.id, "2006-03-14", "MGS3 Subsistence ps2");
  }

  const dmc3 = await findFamily("Devil May Cry 3: Dante's Awakening");
  if (dmc3) {
    await linkEdition(dmc3, "ps2", specialEdition.id, "2006-01-24", "DMC3 Special Edition ps2");
  }

  const p3 = await findFamily("Persona 3");
  if (p3) {
    const fes = await findOrCreateVersion({ slug: "fes", name: "FES", releaseDate: "2008-04-22" });
    await linkEdition(p3, "ps2", fes.id, "2008-04-22", "Persona 3 FES ps2");
    const p3pIgdb = await igdbBySlug("persona-3-portable");
    const portable = await findOrCreateVersion({
      slug: "portable", name: "Portable",
      coverUrl: coverOf(p3pIgdb), releaseDate: "2010-07-06",
    });
    await addEditionGame({
      familyId: p3.id, platformSlug: "psp", date: "2010-07-06",
      versionId: portable.id, coverUrl: coverOf(p3pIgdb),
      label: "Persona 3 Portable psp",
    });
  }

  const ng2004 = await findFamily("Ninja Gaiden (2004)");
  if (ng2004) {
    const blackIgdb = await igdbBySlug("ninja-gaiden-black");
    const black = await findOrCreateVersion({
      slug: "black", name: "Black",
      coverUrl: coverOf(blackIgdb), releaseDate: "2005-09-20",
    });
    await linkEdition(ng2004, "xbox", black.id, "2005-09-20", "Ninja Gaiden Black xbox");
  }

  // ============ Wii era ============
  console.log("\n--- Wii era ---");

  const re4 = await createFamilyWithGames({
    title: "Resident Evil 4",
    slug: "resident-evil-4",
    igdbSlug: "resident-evil-4",
    familyDate: "2005-01-11",
    games: [
      { platformSlug: "gamecube", date: "2005-01-11", versionId: standard.id },
      { platformSlug: "ps2", date: "2005-10-25", versionId: standard.id },
    ],
  });
  if (re4) {
    const wiiEdIgdb = await igdbBySlug("resident-evil-4-wii-edition");
    const wiiEdition = await findOrCreateVersion({
      slug: "wii-edition", name: "Wii Edition",
      coverUrl: coverOf(wiiEdIgdb), releaseDate: "2007-06-19",
    });
    await addEditionGame({
      familyId: re4.id, platformSlug: "wii", date: "2007-06-19",
      versionId: wiiEdition.id, coverUrl: coverOf(wiiEdIgdb),
      label: "RE4 Wii Edition wii",
    });
  }

  // ============ PS3 / X360 era ============
  console.log("\n--- PS3 / X360 era ---");

  const oblivion = await findFamily("The Elder Scrolls IV: Oblivion");
  if (oblivion) {
    await linkEdition(oblivion, "ps3", goty.id, "2007-09-11", "Oblivion GOTY ps3");
    await linkEdition(oblivion, "xbox-360", goty.id, "2007-09-11", "Oblivion GOTY x360");
    const oblRemIgdb = await igdbBySlug("the-elder-scrolls-iv-oblivion-remastered");
    for (const slug of ["ps5", "xbox-series", "steam"]) {
      await addEditionGame({
        familyId: oblivion.id, platformSlug: slug, date: "2025-04-22",
        versionId: remastered.id, coverUrl: coverOf(oblRemIgdb),
        label: `Oblivion Remastered ${slug}`,
      });
    }
  }

  const fallout3 = await findFamily("Fallout 3");
  if (fallout3) {
    await linkEdition(fallout3, "ps3", goty.id, "2009-10-13", "Fallout 3 GOTY ps3");
    await linkEdition(fallout3, "xbox-360", goty.id, "2009-10-13", "Fallout 3 GOTY x360");
  }

  const borderlands = await findFamily("Borderlands");
  if (borderlands) {
    await linkEdition(borderlands, "ps3", goty.id, "2010-10-12", "Borderlands GOTY ps3");
    await linkEdition(borderlands, "xbox-360", goty.id, "2010-10-12", "Borderlands GOTY x360");
  }

  const rdr = await findFamily("Red Dead Redemption");
  if (rdr) {
    await linkEdition(rdr, "ps3", goty.id, "2011-10-11", "RDR GOTY ps3");
    await linkEdition(rdr, "xbox-360", goty.id, "2011-10-11", "RDR GOTY x360");
  }

  const arkhamAsylum = await findFamily("Batman: Arkham Asylum");
  if (arkhamAsylum) {
    await linkEdition(arkhamAsylum, "ps3", goty.id, "2010-05-11", "Arkham Asylum GOTY ps3");
    await linkEdition(arkhamAsylum, "xbox-360", goty.id, "2010-05-11", "Arkham Asylum GOTY x360");
  }

  const arkhamCity = await findFamily("Batman: Arkham City");
  if (arkhamCity) {
    for (const slug of ["ps3", "xbox-360"]) {
      const pid = await platformId(slug);
      if (!pid) continue;
      const existing = await prisma.game.findFirst({
        where: { gameFamilyId: arkhamCity.id, platformId: pid },
      });
      if (!existing) {
        await prisma.game.create({
          data: {
            gameFamilyId: arkhamCity.id,
            platformId: pid,
            releaseDate: new Date("2011-10-18"),
            versions: { connect: [{ id: standard.id }] },
          },
        });
        console.log(`Arkham City ${slug}: created`);
      }
    }
    const acReloaded = await findFamily("Batman: Arkham City");
    await linkEdition(acReloaded, "ps3", goty.id, "2012-05-29", "Arkham City GOTY ps3");
    await linkEdition(acReloaded, "xbox-360", goty.id, "2012-05-29", "Arkham City GOTY x360");
  }

  const legendary = await findOrCreateVersion({
    slug: "legendary-edition", name: "Legendary Edition", releaseDate: "2013-06-04",
  });
  const skyrimSeIgdb = await igdbBySlug("the-elder-scrolls-v-skyrim-special-edition");
  const skyrim = await createFamilyWithGames({
    title: "The Elder Scrolls V: Skyrim",
    slug: "the-elder-scrolls-v-skyrim",
    igdbSlug: "the-elder-scrolls-v-skyrim",
    familyDate: "2011-11-11",
    games: [
      { platformSlug: "ps3", date: "2011-11-11", versionId: standard.id },
      { platformSlug: "xbox-360", date: "2011-11-11", versionId: standard.id },
    ],
  });
  if (skyrim) {
    await linkEdition(skyrim, "ps3", legendary.id, "2013-06-04", "Skyrim Legendary ps3");
    await linkEdition(skyrim, "xbox-360", legendary.id, "2013-06-04", "Skyrim Legendary x360");
    for (const slug of ["ps4", "xbox-one"]) {
      await addEditionGame({
        familyId: skyrim.id, platformSlug: slug, date: "2016-10-28",
        versionId: specialEdition.id, coverUrl: coverOf(skyrimSeIgdb),
        label: `Skyrim Special Edition ${slug}`,
      });
    }
    const switchId = await platformId("switch");
    if (switchId && !(await prisma.game.findFirst({ where: { gameFamilyId: skyrim.id, platformId: switchId } }))) {
      await prisma.game.create({
        data: {
          gameFamilyId: skyrim.id,
          platformId: switchId,
          releaseDate: new Date("2017-11-17"),
          versions: { connect: [{ id: standard.id }] },
        },
      });
      console.log("Skyrim switch: created");
    }
  }

  const p4 = await findFamily("Persona 4");
  if (p4) {
    const goldenIgdb = await igdbBySlug("persona-4-golden");
    const golden = await findOrCreateVersion({
      slug: "golden", name: "Golden",
      coverUrl: coverOf(goldenIgdb), releaseDate: "2012-11-20",
    });
    await addEditionGame({
      familyId: p4.id, platformSlug: "vita", date: "2012-11-20",
      versionId: golden.id, coverUrl: coverOf(goldenIgdb),
      label: "Persona 4 Golden vita",
    });
  }

  const fft = await findFamily("Final Fantasy Tactics");
  if (fft) {
    const fftPsp = fft.games.find((g) => g.platform?.slug === "psp");
    if (fftPsp && fftPsp.releaseDate?.toISOString().startsWith("1998")) {
      await prisma.game.update({
        where: { id: fftPsp.id },
        data: { releaseDate: new Date("2007-10-09") },
      });
      console.log("FFT psp: date fixed to 2007-10-09");
    }
    const wotlIgdb = await igdbBySlug("final-fantasy-tactics-the-war-of-the-lions");
    const wotl = await findOrCreateVersion({
      slug: "war-of-the-lions", name: "The War of the Lions",
      coverUrl: coverOf(wotlIgdb), releaseDate: "2007-10-09",
    });
    await linkEdition(fft, "psp", wotl.id, "2007-10-09", "FFT War of the Lions psp");
  }

  // ============ PS4 era ============
  console.log("\n--- PS4 era ---");

  const tlouRemIgdb = await igdbBySlug("the-last-of-us-remastered");
  const tlou = await createFamilyWithGames({
    title: "The Last of Us",
    slug: "the-last-of-us",
    igdbSlug: "the-last-of-us",
    familyDate: "2013-06-14",
    games: [{ platformSlug: "ps3", date: "2013-06-14", versionId: standard.id }],
  });
  if (tlou) {
    await addEditionGame({
      familyId: tlou.id, platformSlug: "ps4", date: "2014-07-29",
      versionId: remastered.id, coverUrl: coverOf(tlouRemIgdb),
      label: "TLOU Remastered ps4",
    });
  }

  const gow3 = await findFamily("God of War III");
  if (gow3) {
    const gow3rIgdb = await igdbBySlug("god-of-war-iii-remastered");
    await addEditionGame({
      familyId: gow3.id, platformSlug: "ps4", date: "2015-07-14",
      versionId: remastered.id, coverUrl: coverOf(gow3rIgdb),
      label: "GoW III Remastered ps4",
    });
  }

  const hzd = await findFamily("Horizon Zero Dawn");
  if (hzd) {
    await linkEdition(hzd, "ps4", completeEdition.id, "2017-12-05", "HZD Complete Edition ps4");
    const hzdRemIgdb = await igdbBySlug("horizon-zero-dawn-remastered");
    await addEditionGame({
      familyId: hzd.id, platformSlug: "ps5", date: "2024-10-31",
      versionId: remastered.id, coverUrl: coverOf(hzdRemIgdb),
      label: "HZD Remastered ps5",
    });
  }

  const spiderMan = await findFamily("Marvel's Spider-Man");
  if (spiderMan) {
    const smRemIgdb = await igdbBySlug("marvels-spider-man-remastered");
    await addEditionGame({
      familyId: spiderMan.id, platformSlug: "ps5", date: "2020-11-12",
      versionId: remastered.id, coverUrl: coverOf(smRemIgdb),
      label: "Spider-Man Remastered ps5",
    });
  }

  // ============ PS5 era ============
  console.log("\n--- PS5 era ---");

  const got = await findFamily("Ghost of Tsushima");
  if (got) {
    const gotPs5 = got.games.find((g) => g.platform?.slug === "ps5");
    if (gotPs5 && gotPs5.releaseDate?.toISOString().startsWith("2020")) {
      await prisma.game.update({
        where: { id: gotPs5.id },
        data: { releaseDate: new Date("2021-08-20") },
      });
      console.log("Ghost of Tsushima ps5: date fixed to Director's Cut release");
    }
    await linkEdition(got, "ps5", directorsCut.id, "2021-08-20", "GoT Director's Cut ps5");
    await linkEdition(got, "ps4", directorsCut.id, "2021-08-20", "GoT Director's Cut ps4");
  }

  const ds = await findFamily("Death Stranding");
  if (ds) {
    const dsDcIgdb = await igdbBySlug("death-stranding-directors-cut");
    await addEditionGame({
      familyId: ds.id, platformSlug: "ps5", date: "2021-09-24",
      versionId: directorsCut.id, coverUrl: coverOf(dsDcIgdb),
      label: "Death Stranding DC ps5",
    });
  }

  const tlou2 = await findFamily("The Last of Us Part II");
  if (tlou2) {
    const tlou2Ps5 = tlou2.games.find((g) => g.platform?.slug === "ps5");
    if (tlou2Ps5 && tlou2Ps5.releaseDate?.toISOString().startsWith("2020")) {
      await prisma.game.update({
        where: { id: tlou2Ps5.id },
        data: { releaseDate: new Date("2024-01-19") },
      });
      console.log("TLOU Part II ps5: date fixed to Remastered release");
    }
    await linkEdition(tlou2, "ps5", remastered.id, "2024-01-19", "TLOU2 Remastered ps5");
  }

  const cp77 = await findFamily("Cyberpunk 2077");
  if (cp77) {
    await linkEdition(cp77, "ps5", ultimateEdition.id, "2023-12-05", "Cyberpunk UE ps5");
    await linkEdition(cp77, "xbox-series", ultimateEdition.id, "2023-12-05", "Cyberpunk UE xbox-series");
  }

  const w3 = await findFamily("The Witcher 3: Wild Hunt");
  if (w3) {
    await linkEdition(w3, "ps5", completeEdition.id, "2022-12-14", "Witcher 3 CE ps5");
    await linkEdition(w3, "xbox-series", completeEdition.id, "2022-12-14", "Witcher 3 CE xbox-series");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
