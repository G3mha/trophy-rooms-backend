/**
 * Switch 2 special editions audit fixes (2026-07-22):
 *
 * Date fixes on existing S2 entries:
 * - Animal Crossing NH S2 Edition released 2026-01-15 (not launch day)
 * - Super Mario Bros. Wonder S2 + Bellabel Park released 2026-03-26
 * - Super Mario Party Jamboree S2 + Jamboree TV released 2025-07-24
 * - Street Fighter 6 S2 (Years 1-2 Fighters Edition) released 2025-06-05
 * - Cyberpunk 2077 S2 (Ultimate Edition) released 2025-06-05
 * - Elden Ring S2 (Tarnished Edition) releases 2026-08-28 (delayed)
 * - Hades II: v1.0 Switch/Switch 2 2025-09-25, PS5 2026-04-14
 *
 * Version relinks (Standard -> proper edition):
 * - Pokemon Legends: Z-A S2 -> "Nintendo Switch 2 Edition"
 * - SF6 S2 -> "Years 1-2 Fighters Edition"
 * - Cyberpunk S2 -> "Ultimate Edition"; Elden S2 -> "Tarnished Edition"
 *
 * New entries:
 * - Yakuza 0: Director's Cut on Switch 2 (2025-06-05)
 * - Metroid Prime 4: Beyond on Switch 1 (cross-gen, 2025-12-04)
 * - Hades II on Switch 1 (cross-gen, 2025-09-25)
 * - Hitman: World of Assassination family (PS5/XSX/Steam 2023-01-26,
 *   Switch 2 Signature Edition 2025-06-05)
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

async function familyWithGames(title: string) {
  return prisma.gameFamily.findFirst({
    where: { title: { equals: title, mode: "insensitive" } },
    include: { games: { include: { platform: true, versions: true } } },
  });
}

type FamilyResult = Awaited<ReturnType<typeof familyWithGames>>;

function gameOn(family: FamilyResult, platformSlug: string) {
  return family?.games.find((g) => g.platform?.slug === platformSlug);
}

async function setDate(
  game: { id: string; releaseDate: Date | null } | undefined,
  label: string,
  dateString: string
) {
  if (!game) {
    console.log(`${label}: game not found, skipped`);
    return;
  }
  const date = new Date(dateString);
  if (game.releaseDate?.getTime() === date.getTime()) {
    console.log(`${label}: already ${dateString}`);
    return;
  }
  await prisma.game.update({ where: { id: game.id }, data: { releaseDate: date } });
  console.log(`${label}: set ${dateString}`);
}

async function findOrCreateVersion(data: {
  slug: string;
  name: string;
  coverUrl?: string | null;
  releaseDate?: string | null;
  description?: string | null;
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
      description: data.description ?? null,
      isDefault: false,
    },
  });
  console.log(`Created version: ${version.name}`);
  return version;
}

async function relinkVersion(
  game: { id: string; versions: { id: string; slug: string }[] } | undefined,
  label: string,
  toVersionId: string,
  disconnectSlug: string | null
) {
  if (!game) {
    console.log(`${label}: game not found, skipped`);
    return;
  }
  if (game.versions.some((v) => v.id === toVersionId)) {
    console.log(`${label}: already linked`);
    return;
  }
  const disconnect = disconnectSlug
    ? game.versions.filter((v) => v.slug === disconnectSlug).map((v) => ({ id: v.id }))
    : [];
  await prisma.game.update({
    where: { id: game.id },
    data: {
      versions: {
        connect: [{ id: toVersionId }],
        ...(disconnect.length > 0 ? { disconnect } : {}),
      },
    },
  });
  console.log(`${label}: relinked`);
}

async function setGameCover(
  game: { id: string; coverUrl: string | null } | undefined,
  label: string,
  coverUrl: string | null
) {
  if (!game || !coverUrl || game.coverUrl) return;
  await prisma.game.update({ where: { id: game.id }, data: { coverUrl } });
  console.log(`${label}: set explicit cover`);
}

async function main() {
  console.log("=== Switch 2 special editions fixes ===\n");

  const switch1 = await prisma.platform.findUnique({ where: { slug: "switch" } });
  const switch2 = await prisma.platform.findUnique({ where: { slug: "switch-2" } });
  if (!switch1 || !switch2) {
    console.error("Switch platforms not found");
    return;
  }

  // --- First-party date fixes ---
  const acnh = await familyWithGames("Animal Crossing: New Horizons");
  await setDate(gameOn(acnh, "switch-2"), "ACNH switch-2", "2026-01-15");

  const wonder = await familyWithGames("Super Mario Bros. Wonder");
  await setDate(gameOn(wonder, "switch-2"), "Wonder switch-2", "2026-03-26");

  const jamboree = await familyWithGames("Super Mario Party Jamboree");
  await setDate(gameOn(jamboree, "switch-2"), "Jamboree switch-2", "2025-07-24");

  // --- Pokemon Legends: Z-A -> proper S2 Edition version ---
  const za = await familyWithGames("Pokémon Legends: Z-A");
  const zaVersion = await findOrCreateVersion({
    slug: "switch-2-edition-za",
    name: "Nintendo Switch 2 Edition",
    releaseDate: "2025-10-16",
  });
  await relinkVersion(gameOn(za, "switch-2"), "Z-A switch-2 version", zaVersion.id, "standard");

  // --- Street Fighter 6: Years 1-2 Fighters Edition ---
  const sf6 = await familyWithGames("Street Fighter 6");
  const sf6Igdb = await igdbBySlug("street-fighter-6-years-1-2-fighters-edition");
  const sf6Version = await findOrCreateVersion({
    slug: "years-1-2-fighters-edition",
    name: "Years 1-2 Fighters Edition",
    coverUrl: coverOf(sf6Igdb),
    releaseDate: "2025-06-05",
  });
  const sf6S2 = gameOn(sf6, "switch-2");
  await setDate(sf6S2, "SF6 switch-2", "2025-06-05");
  await relinkVersion(sf6S2, "SF6 switch-2 version", sf6Version.id, "standard");
  await setGameCover(sf6S2, "SF6 switch-2 cover", coverOf(sf6Igdb));

  // --- Cyberpunk 2077: Ultimate Edition ---
  const cp77 = await familyWithGames("Cyberpunk 2077");
  const cp77Igdb = await igdbBySlug("cyberpunk-2077-ultimate-edition");
  const ultimateVersion = await findOrCreateVersion({
    slug: "ultimate-edition",
    name: "Ultimate Edition",
    coverUrl: coverOf(cp77Igdb),
  });
  const cp77S2 = gameOn(cp77, "switch-2");
  await setDate(cp77S2, "Cyberpunk switch-2", "2025-06-05");
  await relinkVersion(cp77S2, "Cyberpunk switch-2 version", ultimateVersion.id, "standard");
  await setGameCover(cp77S2, "Cyberpunk switch-2 cover", coverOf(cp77Igdb));
  if (cp77S2) {
    await prisma.gameVersionReleaseDate.upsert({
      where: {
        gameId_gameVersionId: { gameId: cp77S2.id, gameVersionId: ultimateVersion.id },
      },
      update: { releaseDate: new Date("2025-06-05") },
      create: {
        gameId: cp77S2.id,
        gameVersionId: ultimateVersion.id,
        releaseDate: new Date("2025-06-05"),
      },
    });
  }

  // --- Elden Ring: Tarnished Edition (releases 2026-08-28) ---
  const eldenRing = await familyWithGames("Elden Ring");
  const tarnishedIgdb = await igdbBySlug("elden-ring-tarnished-edition");
  const tarnishedVersion = await findOrCreateVersion({
    slug: "tarnished-edition",
    name: "Tarnished Edition",
    coverUrl: coverOf(tarnishedIgdb),
    releaseDate: "2026-08-28",
    description:
      "Includes the base game and the Shadow of the Erdtree expansion, plus new armor and features.",
  });
  const eldenS2 = gameOn(eldenRing, "switch-2");
  await setDate(eldenS2, "Elden Ring switch-2", "2026-08-28");
  await relinkVersion(eldenS2, "Elden Ring switch-2 version", tarnishedVersion.id, "standard");
  await setGameCover(eldenS2, "Elden Ring switch-2 cover", coverOf(tarnishedIgdb));

  // --- Yakuza 0: Director's Cut on Switch 2 ---
  const yakuza0 = await familyWithGames("Yakuza 0");
  if (yakuza0 && !gameOn(yakuza0, "switch-2")) {
    const dcIgdb = await igdbBySlug("yakuza-0-directors-cut");
    const dcVersion = await findOrCreateVersion({
      slug: "directors-cut",
      name: "Director's Cut",
      coverUrl: coverOf(dcIgdb),
    });
    const game = await prisma.game.create({
      data: {
        gameFamilyId: yakuza0.id,
        platformId: switch2.id,
        releaseDate: new Date("2025-06-05"),
        coverUrl: coverOf(dcIgdb),
        versions: { connect: [{ id: dcVersion.id }] },
      },
    });
    await prisma.gameVersionReleaseDate.upsert({
      where: {
        gameId_gameVersionId: { gameId: game.id, gameVersionId: dcVersion.id },
      },
      update: { releaseDate: new Date("2025-06-05") },
      create: {
        gameId: game.id,
        gameVersionId: dcVersion.id,
        releaseDate: new Date("2025-06-05"),
      },
    });
    console.log("Yakuza 0: created switch-2 Director's Cut entry");
  } else {
    console.log("Yakuza 0: switch-2 entry already exists or family missing");
  }

  // --- Metroid Prime 4: Beyond on Switch 1 (cross-gen) ---
  const mp4 = await familyWithGames("Metroid Prime 4: Beyond");
  if (mp4 && !gameOn(mp4, "switch")) {
    const standard = await prisma.gameVersion.findUnique({ where: { slug: "standard" } });
    await prisma.game.create({
      data: {
        gameFamilyId: mp4.id,
        platformId: switch1.id,
        releaseDate: new Date("2025-12-04"),
        coverUrl: mp4.coverUrl,
        ...(standard ? { versions: { connect: [{ id: standard.id }] } } : {}),
      },
    });
    console.log("Metroid Prime 4: created switch entry");
  } else {
    console.log("Metroid Prime 4: switch entry already exists or family missing");
  }

  // --- Hades II: cross-gen dates + Switch 1 entry ---
  const hades2 = await familyWithGames("Hades II");
  await setDate(gameOn(hades2, "switch-2"), "Hades II switch-2", "2025-09-25");
  await setDate(gameOn(hades2, "ps5"), "Hades II ps5", "2026-04-14");
  if (hades2 && !gameOn(hades2, "switch")) {
    const standard = await prisma.gameVersion.findUnique({ where: { slug: "standard" } });
    await prisma.game.create({
      data: {
        gameFamilyId: hades2.id,
        platformId: switch1.id,
        releaseDate: new Date("2025-09-25"),
        ...(standard ? { versions: { connect: [{ id: standard.id }] } } : {}),
      },
    });
    console.log("Hades II: created switch entry");
  }

  // --- Hitman: World of Assassination family ---
  const woaExisting = await prisma.gameFamily.findFirst({
    where: { title: { equals: "Hitman: World of Assassination", mode: "insensitive" } },
  });
  if (!woaExisting) {
    const woaIgdb = await igdbBySlug("hitman-world-of-assassination");
    const family = await prisma.gameFamily.create({
      data: {
        title: "Hitman: World of Assassination",
        slug: "hitman-world-of-assassination",
        description: woaIgdb?.summary || null,
        coverUrl: coverOf(woaIgdb),
        releaseDate: new Date("2023-01-26"),
      },
    });
    const standard = await prisma.gameVersion.findUnique({ where: { slug: "standard" } });
    for (const slug of ["ps5", "xbox-series", "steam"]) {
      const platform = await prisma.platform.findUnique({ where: { slug } });
      if (!platform) continue;
      await prisma.game.create({
        data: {
          gameFamilyId: family.id,
          platformId: platform.id,
          releaseDate: new Date("2023-01-26"),
          ...(standard ? { versions: { connect: [{ id: standard.id }] } } : {}),
        },
      });
    }
    const signatureVersion = await findOrCreateVersion({
      slug: "signature-edition",
      name: "Signature Edition",
      releaseDate: "2025-06-05",
    });
    await prisma.game.create({
      data: {
        gameFamilyId: family.id,
        platformId: switch2.id,
        releaseDate: new Date("2025-06-05"),
        versions: { connect: [{ id: signatureVersion.id }] },
      },
    });
    console.log("Hitman WoA: created family with ps5/xbox-series/steam/switch-2");
  } else {
    console.log("Hitman WoA: family already exists");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
