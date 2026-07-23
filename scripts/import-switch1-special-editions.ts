/**
 * Switch 1 special editions audit fixes (2026-07-22):
 *
 * Merges (same game, split families -> one family per the data model rules):
 * - "New Super Mario Bros. U Deluxe" game moves under "New Super Mario Bros. U"
 * - "Hyrule Warriors: Definitive Edition" game moves under "Hyrule Warriors"
 *
 * New Switch edition entries under existing families:
 * - Mario Kart 8 Deluxe (2017-04-28), Pikmin 3 Deluxe (2020-10-30),
 *   Kirby's Return to Dream Land Deluxe (2023-02-24),
 *   Xenoblade Chronicles: Definitive Edition (2020-05-29),
 *   Persona 5 Royal (2022-10-21, + Royal linked to the PS4 game @ 2020-03-31),
 *   Dragon Quest XI S: Definitive Edition (2019-09-27, + Switch 2 Edition
 *   2026-09-24), Catherine: Full Body (2020-07-07),
 *   The Witcher 3 Complete Edition (relink + date fix 2019-10-15)
 *
 * New families:
 * - Pokkén Tournament (Wii U 2016-03-18) + DX on Switch (2017-09-22)
 * - Xenoblade Chronicles X (Wii U 2015-12-04) + DE on Switch (2025-03-20)
 * - Dark Souls (PS3/X360 2011-10-04) + Remastered (PS4 2018-05-25,
 *   Switch 2018-10-19)
 * - Divinity: Original Sin 2 (Steam 2017-09-14) + Definitive Edition
 *   (PS4/XB1 2018-08-31, Switch 2019-09-04)
 * - Grand Theft Auto: The Trilogy - The Definitive Edition (2021-11-11)
 */

import { PrismaClient } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

async function igdbBySlug(slug: string): Promise<IGDBGame | null> {
  const [game] = await igdbRequest<IGDBGame[]>(
    "games",
    `fields id, name, slug, summary, cover.image_id, first_release_date;
     where slug = "${slug}"; limit 1;`
  );
  return game ?? null;
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
  const existing = await prisma.gameVersion.findUnique({
    where: { slug: data.slug },
  });
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

async function createEditionGame(opts: {
  familyId: string;
  platformSlug: string;
  date: string;
  versionId: string;
  coverUrl?: string | null;
  label: string;
}) {
  const pid = await platformId(opts.platformSlug);
  if (!pid) {
    console.log(`${opts.label}: platform ${opts.platformSlug} missing, skipped`);
    return null;
  }
  const existing = await prisma.game.findFirst({
    where: { gameFamilyId: opts.familyId, platformId: pid },
  });
  if (existing) {
    console.log(`${opts.label}: already exists`);
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
  console.log(`${opts.label}: created`);
  return game;
}

async function versionDateOverride(gameId: string, versionId: string, date: string) {
  await prisma.gameVersionReleaseDate.upsert({
    where: { gameId_gameVersionId: { gameId, gameVersionId: versionId } },
    update: { releaseDate: new Date(date) },
    create: { gameId, gameVersionId: versionId, releaseDate: new Date(date) },
  });
}

/** Move the single game of a wrongly-split edition family under the base
 * family, link the edition version, then delete the empty family if safe. */
async function mergeSplitFamily(opts: {
  editionFamilyTitle: string;
  baseFamilyTitle: string;
  versionId: string;
  fixDate?: string;
}) {
  const editionFamily = await prisma.gameFamily.findFirst({
    where: { title: { equals: opts.editionFamilyTitle, mode: "insensitive" } },
    include: {
      games: true,
      _count: { select: { achievementSets: true, dlcs: true, bundles: true, buylistItems: true } },
    },
  });
  const baseFamily = await findFamily(opts.baseFamilyTitle);
  if (!editionFamily || !baseFamily) {
    console.log(`Merge ${opts.editionFamilyTitle}: family missing, skipped`);
    return;
  }

  for (const game of editionFamily.games) {
    await prisma.game.update({
      where: { id: game.id },
      data: {
        gameFamilyId: baseFamily.id,
        // Keep the edition box art on the platform game
        coverUrl: game.coverUrl ?? editionFamily.coverUrl,
        ...(opts.fixDate ? { releaseDate: new Date(opts.fixDate) } : {}),
        versions: { connect: [{ id: opts.versionId }] },
      },
    });
    const standard = await prisma.gameVersion.findUnique({ where: { slug: "standard" } });
    if (standard) {
      await prisma.game.update({
        where: { id: game.id },
        data: { versions: { disconnect: [{ id: standard.id }] } },
      });
    }
  }

  const { achievementSets, dlcs, bundles, buylistItems } = editionFamily._count;
  if (achievementSets + dlcs + bundles + buylistItems === 0) {
    await prisma.gameFamily.delete({ where: { id: editionFamily.id } });
    console.log(`Merge ${opts.editionFamilyTitle}: merged into ${baseFamily.title}, empty family deleted`);
  } else {
    console.log(`Merge ${opts.editionFamilyTitle}: games moved, family kept (has relations)`);
  }
}

async function main() {
  console.log("=== Switch 1 special editions fixes ===\n");

  // Shared edition versions
  const deluxe = await findOrCreateVersion({ slug: "deluxe", name: "Deluxe" });
  const dx = await findOrCreateVersion({ slug: "dx", name: "DX" });
  const definitive = await findOrCreateVersion({ slug: "definitive-edition", name: "Definitive Edition" });
  const complete = await findOrCreateVersion({ slug: "complete-edition", name: "Complete Edition" });
  const remastered = await findOrCreateVersion({ slug: "remastered", name: "Remastered" });
  const standard = await findOrCreateVersion({ slug: "standard", name: "Standard" });

  // --- Merges of wrongly-split edition families ---
  await mergeSplitFamily({
    editionFamilyTitle: "New Super Mario Bros. U Deluxe",
    baseFamilyTitle: "New Super Mario Bros. U",
    versionId: deluxe.id,
  });
  await mergeSplitFamily({
    editionFamilyTitle: "Hyrule Warriors: Definitive Edition",
    baseFamilyTitle: "Hyrule Warriors",
    versionId: definitive.id,
    fixDate: "2018-05-18",
  });

  // --- Deluxe ports under existing families ---
  const mk8 = await findFamily("Mario Kart 8");
  if (mk8) {
    const igdb = await igdbBySlug("mario-kart-8-deluxe");
    await createEditionGame({
      familyId: mk8.id,
      platformSlug: "switch",
      date: "2017-04-28",
      versionId: deluxe.id,
      coverUrl: coverOf(igdb),
      label: "Mario Kart 8 Deluxe switch",
    });
  }

  const pikmin3 = await findFamily("Pikmin 3");
  if (pikmin3) {
    const igdb = await igdbBySlug("pikmin-3-deluxe");
    await createEditionGame({
      familyId: pikmin3.id,
      platformSlug: "switch",
      date: "2020-10-30",
      versionId: deluxe.id,
      coverUrl: coverOf(igdb),
      label: "Pikmin 3 Deluxe switch",
    });
  }

  const krtdl = await findFamily("Kirby's Return to Dream Land");
  if (krtdl) {
    const igdb = await igdbBySlug("kirbys-return-to-dream-land-deluxe");
    await createEditionGame({
      familyId: krtdl.id,
      platformSlug: "switch",
      date: "2023-02-24",
      versionId: deluxe.id,
      coverUrl: coverOf(igdb),
      label: "Kirby's Return to Dream Land Deluxe switch",
    });
  }

  // --- Pokkén Tournament (new family) + DX ---
  let pokken = await findFamily("Pokkén Tournament");
  if (!pokken) {
    const baseIgdb = await igdbBySlug("pokken-tournament");
    const created = await prisma.gameFamily.create({
      data: {
        title: "Pokkén Tournament",
        slug: "pokken-tournament",
        description: baseIgdb?.summary || null,
        coverUrl: coverOf(baseIgdb),
        releaseDate: new Date("2016-03-18"),
      },
    });
    console.log("Created family: Pokkén Tournament");
    const wiiuId = await platformId("wii-u");
    if (wiiuId) {
      await prisma.game.create({
        data: {
          gameFamilyId: created.id,
          platformId: wiiuId,
          releaseDate: new Date("2016-03-18"),
          versions: { connect: [{ id: standard.id }] },
        },
      });
    }
    pokken = await findFamily("Pokkén Tournament");
  }
  if (pokken) {
    const dxIgdb = await igdbBySlug("pokken-tournament-dx");
    await createEditionGame({
      familyId: pokken.id,
      platformSlug: "switch",
      date: "2017-09-22",
      versionId: dx.id,
      coverUrl: coverOf(dxIgdb),
      label: "Pokkén Tournament DX switch",
    });
  }

  // --- Xenoblade Chronicles: Definitive Edition ---
  const xc = await findFamily("Xenoblade Chronicles");
  if (xc) {
    const igdb = await igdbBySlug("xenoblade-chronicles-definitive-edition");
    await createEditionGame({
      familyId: xc.id,
      platformSlug: "switch",
      date: "2020-05-29",
      versionId: definitive.id,
      coverUrl: coverOf(igdb),
      label: "Xenoblade Chronicles DE switch",
    });
  }

  // --- Xenoblade Chronicles X (new family) + DE ---
  let xcx = await findFamily("Xenoblade Chronicles X");
  if (!xcx) {
    const baseIgdb = await igdbBySlug("xenoblade-chronicles-x");
    const created = await prisma.gameFamily.create({
      data: {
        title: "Xenoblade Chronicles X",
        slug: "xenoblade-chronicles-x",
        description: baseIgdb?.summary || null,
        coverUrl: coverOf(baseIgdb),
        releaseDate: new Date("2015-12-04"),
      },
    });
    console.log("Created family: Xenoblade Chronicles X");
    const wiiuId = await platformId("wii-u");
    if (wiiuId) {
      await prisma.game.create({
        data: {
          gameFamilyId: created.id,
          platformId: wiiuId,
          releaseDate: new Date("2015-12-04"),
          versions: { connect: [{ id: standard.id }] },
        },
      });
    }
    xcx = await findFamily("Xenoblade Chronicles X");
  }
  if (xcx) {
    const igdb = await igdbBySlug("xenoblade-chronicles-x-definitive-edition");
    await createEditionGame({
      familyId: xcx.id,
      platformSlug: "switch",
      date: "2025-03-20",
      versionId: definitive.id,
      coverUrl: coverOf(igdb),
      label: "Xenoblade Chronicles X DE switch",
    });
  }

  // --- The Witcher 3: Complete Edition on Switch (+ next-gen dates) ---
  const w3 = await findFamily("The Witcher 3: Wild Hunt");
  if (w3) {
    const w3Switch = w3.games.find((g) => g.platform?.slug === "switch");
    if (w3Switch) {
      await prisma.game.update({
        where: { id: w3Switch.id },
        data: {
          releaseDate: new Date("2019-10-15"),
          versions: {
            connect: [{ id: complete.id }],
            disconnect: [{ id: standard.id }],
          },
        },
      });
      await versionDateOverride(w3Switch.id, complete.id, "2019-10-15");
      console.log("Witcher 3 switch: Complete Edition linked, date fixed");
    }
    for (const slug of ["ps5", "xbox-series"]) {
      const g = w3.games.find((x) => x.platform?.slug === slug);
      if (g && g.releaseDate?.toISOString().startsWith("2015")) {
        await prisma.game.update({
          where: { id: g.id },
          data: { releaseDate: new Date("2022-12-14") },
        });
        console.log(`Witcher 3 ${slug}: next-gen date set`);
      }
    }
  }

  // --- Persona 5 Royal ---
  const p5 = await findFamily("Persona 5");
  if (p5) {
    const royalIgdb = await igdbBySlug("persona-5-royal");
    const royal = await findOrCreateVersion({
      slug: "royal",
      name: "Royal",
      coverUrl: coverOf(royalIgdb),
      releaseDate: "2020-03-31",
    });
    await createEditionGame({
      familyId: p5.id,
      platformSlug: "switch",
      date: "2022-10-21",
      versionId: royal.id,
      coverUrl: coverOf(royalIgdb),
      label: "Persona 5 Royal switch",
    });
    const p5ps4 = p5.games.find((g) => g.platform?.slug === "ps4");
    if (p5ps4 && !p5ps4.versions.some((v) => v.slug === "royal")) {
      await prisma.game.update({
        where: { id: p5ps4.id },
        data: { versions: { connect: [{ id: royal.id }] } },
      });
      await versionDateOverride(p5ps4.id, royal.id, "2020-03-31");
      console.log("Persona 5 ps4: Royal linked with 2020-03-31 override");
    }
  }

  // --- Dragon Quest XI S: Definitive Edition (+ Switch 2 Edition) ---
  const dqxi = await findFamily("Dragon Quest XI: Echoes of an Elusive Age");
  if (dqxi) {
    const sIgdb = await igdbBySlug("dragon-quest-xi-s-echoes-of-an-elusive-age-definitive-edition");
    const sDefinitive = await findOrCreateVersion({
      slug: "s-definitive-edition",
      name: "S: Definitive Edition",
      coverUrl: coverOf(sIgdb),
      releaseDate: "2019-09-27",
    });
    await createEditionGame({
      familyId: dqxi.id,
      platformSlug: "switch",
      date: "2019-09-27",
      versionId: sDefinitive.id,
      coverUrl: coverOf(sIgdb),
      label: "DQ XI S switch",
    });
    const dqxiS2Version = await findOrCreateVersion({
      slug: "switch-2-edition-dqxis",
      name: "Nintendo Switch 2 Edition",
      releaseDate: "2026-09-24",
    });
    await createEditionGame({
      familyId: dqxi.id,
      platformSlug: "switch-2",
      date: "2026-09-24",
      versionId: dqxiS2Version.id,
      coverUrl: coverOf(sIgdb),
      label: "DQ XI S switch-2",
    });
  }

  // --- Catherine: Full Body ---
  const catherine = await findFamily("Catherine");
  if (catherine) {
    const fbIgdb = await igdbBySlug("catherine-full-body");
    const fullBody = await findOrCreateVersion({
      slug: "full-body",
      name: "Full Body",
      coverUrl: coverOf(fbIgdb),
      releaseDate: "2019-09-03",
    });
    const game = await createEditionGame({
      familyId: catherine.id,
      platformSlug: "switch",
      date: "2020-07-07",
      versionId: fullBody.id,
      coverUrl: coverOf(fbIgdb),
      label: "Catherine: Full Body switch",
    });
    if (game) await versionDateOverride(game.id, fullBody.id, "2020-07-07");
  }

  // --- Dark Souls (new family) + Remastered ---
  let darkSouls = await findFamily("Dark Souls");
  if (!darkSouls) {
    const baseIgdb = await igdbBySlug("dark-souls");
    const created = await prisma.gameFamily.create({
      data: {
        title: "Dark Souls",
        slug: "dark-souls",
        description: baseIgdb?.summary || null,
        coverUrl: coverOf(baseIgdb),
        releaseDate: new Date("2011-10-04"),
      },
    });
    console.log("Created family: Dark Souls");
    for (const slug of ["ps3", "xbox-360"]) {
      const pid = await platformId(slug);
      if (!pid) continue;
      await prisma.game.create({
        data: {
          gameFamilyId: created.id,
          platformId: pid,
          releaseDate: new Date("2011-10-04"),
          versions: { connect: [{ id: standard.id }] },
        },
      });
    }
    darkSouls = await findFamily("Dark Souls");
  }
  if (darkSouls) {
    const remIgdb = await igdbBySlug("dark-souls-remastered");
    const dsPs4 = await createEditionGame({
      familyId: darkSouls.id,
      platformSlug: "ps4",
      date: "2018-05-25",
      versionId: remastered.id,
      coverUrl: coverOf(remIgdb),
      label: "Dark Souls Remastered ps4",
    });
    const dsSwitch = await createEditionGame({
      familyId: darkSouls.id,
      platformSlug: "switch",
      date: "2018-10-19",
      versionId: remastered.id,
      coverUrl: coverOf(remIgdb),
      label: "Dark Souls Remastered switch",
    });
    if (dsPs4) await versionDateOverride(dsPs4.id, remastered.id, "2018-05-25");
    if (dsSwitch) await versionDateOverride(dsSwitch.id, remastered.id, "2018-10-19");
  }

  // --- Divinity: Original Sin 2 (new family) + Definitive Edition ---
  let divinity = await findFamily("Divinity: Original Sin 2");
  if (!divinity) {
    const baseIgdb = await igdbBySlug("divinity-original-sin-2");
    const created = await prisma.gameFamily.create({
      data: {
        title: "Divinity: Original Sin 2",
        slug: "divinity-original-sin-2",
        description: baseIgdb?.summary || null,
        coverUrl: coverOf(baseIgdb),
        releaseDate: new Date("2017-09-14"),
      },
    });
    console.log("Created family: Divinity: Original Sin 2");
    const steamId = await platformId("steam");
    if (steamId) {
      await prisma.game.create({
        data: {
          gameFamilyId: created.id,
          platformId: steamId,
          releaseDate: new Date("2017-09-14"),
          versions: { connect: [{ id: standard.id }] },
        },
      });
    }
    divinity = await findFamily("Divinity: Original Sin 2");
  }
  if (divinity) {
    const deIgdb = await igdbBySlug("divinity-original-sin-2-definitive-edition");
    for (const [slug, date] of [
      ["ps4", "2018-08-31"],
      ["xbox-one", "2018-08-31"],
      ["switch", "2019-09-04"],
    ] as const) {
      const game = await createEditionGame({
        familyId: divinity.id,
        platformSlug: slug,
        date,
        versionId: definitive.id,
        coverUrl: coverOf(deIgdb),
        label: `Divinity OS2 DE ${slug}`,
      });
      if (game) await versionDateOverride(game.id, definitive.id, date);
    }
  }

  // --- GTA: The Trilogy - The Definitive Edition (new family) ---
  const gtaTitle = "Grand Theft Auto: The Trilogy - The Definitive Edition";
  const gtaExisting = await prisma.gameFamily.findFirst({
    where: {
      OR: [
        { slug: "gta-the-trilogy-definitive-edition" },
        { title: { contains: "Grand Theft Auto: The Trilogy", mode: "insensitive" } },
      ],
    },
  });
  if (!gtaExisting) {
    const igdb = await igdbBySlug("grand-theft-auto-the-trilogy-the-definitive-edition");
    const created = await prisma.gameFamily.create({
      data: {
        title: gtaTitle,
        slug: "gta-the-trilogy-definitive-edition",
        description: igdb?.summary || null,
        coverUrl: coverOf(igdb),
        releaseDate: new Date("2021-11-11"),
      },
    });
    console.log("Created family: GTA Trilogy DE");
    for (const slug of ["switch", "ps4", "ps5", "xbox-one", "xbox-series"]) {
      const pid = await platformId(slug);
      if (!pid) continue;
      await prisma.game.create({
        data: {
          gameFamilyId: created.id,
          platformId: pid,
          releaseDate: new Date("2021-11-11"),
          versions: { connect: [{ id: standard.id }] },
        },
      });
    }
  } else {
    console.log(`GTA Trilogy: family already exists (${gtaExisting.title})`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
