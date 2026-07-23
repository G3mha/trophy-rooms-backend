/**
 * Zelda franchise pass (2026-07-22).
 *
 * - Create missing families: Twilight Princess (Wii/GC 2006), The Wind
 *   Waker HD (Wii U 2013), Twilight Princess HD (Wii U 2016)
 * - Skyward Sword original was seeded on wii-u with the Wii date: move it
 *   to the Wii (2011-11-20) and add the Wii U eShop release (2016-09-01)
 * - Breath of the Wild: add the Wii U launch entry (2017-03-03)
 * - Link's Awakening: add the Game Boy Color DX release (1998-12-01)
 * - Echoes of Wisdom: set missing release date (2024-09-26)
 * - Ocarina of Time 3D / Majora's Mask 3D: link Standard version
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
      ...(opts.versionId ? { versions: { connect: [{ id: opts.versionId }] } } : {}),
    },
  });
  console.log(`${opts.label}: created`);
}

async function main() {
  console.log("=== Zelda franchise pass ===\n");

  const standard = await prisma.gameVersion.findUnique({ where: { slug: "standard" } });
  if (!standard) {
    console.error("Standard version missing");
    return;
  }

  // --- Twilight Princess (missing entirely) ---
  const tpExisting = await prisma.gameFamily.findFirst({
    where: { title: { equals: "The Legend of Zelda: Twilight Princess", mode: "insensitive" } },
  });
  if (!tpExisting) {
    const igdb = await igdbBySlug("the-legend-of-zelda-twilight-princess");
    const tp = await prisma.gameFamily.create({
      data: {
        title: "The Legend of Zelda: Twilight Princess",
        slug: "the-legend-of-zelda-twilight-princess",
        description: igdb?.summary || null,
        coverUrl: coverOf(igdb),
        releaseDate: new Date("2006-11-19"),
      },
    });
    console.log("Created family: Twilight Princess");
    await ensureGame({ familyId: tp.id, platformSlug: "wii", date: "2006-11-19", versionId: standard.id, label: "TP wii" });
    await ensureGame({ familyId: tp.id, platformSlug: "gamecube", date: "2006-12-11", versionId: standard.id, label: "TP gamecube" });
  } else {
    console.log("Twilight Princess: family already exists");
  }

  // --- Wind Waker HD / Twilight Princess HD (separate families, matching
  //     the seeded Skyward Sword HD pattern) ---
  for (const hd of [
    {
      title: "The Legend of Zelda: The Wind Waker HD",
      slug: "the-legend-of-zelda-the-wind-waker-hd",
      igdbSlug: "the-legend-of-zelda-the-wind-waker-hd",
      date: "2013-10-04",
    },
    {
      title: "The Legend of Zelda: Twilight Princess HD",
      slug: "the-legend-of-zelda-twilight-princess-hd",
      igdbSlug: "the-legend-of-zelda-twilight-princess-hd",
      date: "2016-03-04",
    },
  ]) {
    const existing = await prisma.gameFamily.findFirst({
      where: { title: { equals: hd.title, mode: "insensitive" } },
    });
    if (existing) {
      console.log(`${hd.title}: already exists`);
      continue;
    }
    const igdb = await igdbBySlug(hd.igdbSlug);
    const family = await prisma.gameFamily.create({
      data: {
        title: hd.title,
        slug: hd.slug,
        description: igdb?.summary || null,
        coverUrl: coverOf(igdb),
        releaseDate: new Date(hd.date),
      },
    });
    console.log(`Created family: ${hd.title}`);
    await ensureGame({
      familyId: family.id, platformSlug: "wii-u", date: hd.date,
      versionId: standard.id, label: `${hd.title} wii-u`,
    });
  }

  // --- Skyward Sword: seeded on wii-u with the Wii launch date ---
  const ss = await findFamily("The Legend of Zelda: Skyward Sword");
  if (ss) {
    const misplaced = ss.games.find(
      (g) => g.platform?.slug === "wii-u" && g.releaseDate?.toISOString().startsWith("2011")
    );
    const wiiId = await platformId("wii");
    const hasWii = ss.games.some((g) => g.platform?.slug === "wii");
    if (misplaced && wiiId && !hasWii) {
      await prisma.game.update({
        where: { id: misplaced.id },
        data: { platformId: wiiId, releaseDate: new Date("2011-11-20") },
      });
      console.log("Skyward Sword: moved to wii with correct date");
      await ensureGame({
        familyId: ss.id, platformSlug: "wii-u", date: "2016-09-01",
        versionId: standard.id, label: "Skyward Sword wii-u eShop",
      });
    } else {
      console.log("Skyward Sword: nothing to fix");
    }
  }

  // --- BotW Wii U launch entry ---
  const botw = await findFamily("The Legend of Zelda: Breath of the Wild");
  if (botw) {
    await ensureGame({
      familyId: botw.id, platformSlug: "wii-u", date: "2017-03-03",
      versionId: standard.id, label: "BotW wii-u",
    });
  }

  // --- Link's Awakening DX (GBC) ---
  const la = await findFamily("The Legend of Zelda: Link's Awakening");
  if (la) {
    let dx = await prisma.gameVersion.findUnique({ where: { slug: "dx" } });
    if (!dx) {
      dx = await prisma.gameVersion.create({
        data: { name: "DX", slug: "dx", isDefault: false },
      });
      console.log("Created version: DX");
    }
    await ensureGame({
      familyId: la.id, platformSlug: "game-boy-color", date: "1998-12-01",
      versionId: dx.id, label: "Link's Awakening DX gbc",
    });
  }

  // --- Echoes of Wisdom missing date ---
  const eow = await findFamily("The Legend of Zelda: Echoes of Wisdom");
  const eowSwitch = eow?.games.find((g) => g.platform?.slug === "switch");
  if (eowSwitch && !eowSwitch.releaseDate) {
    await prisma.game.update({
      where: { id: eowSwitch.id },
      data: { releaseDate: new Date("2024-09-26") },
    });
    console.log("Echoes of Wisdom: date set");
  }

  // --- OoT 3D / MM 3D: no version linked ---
  for (const title of [
    "The Legend of Zelda: Ocarina of Time 3D",
    "The Legend of Zelda: Majora's Mask 3D",
  ]) {
    const family = await findFamily(title);
    const game = family?.games.find((g) => g.platform?.slug === "3ds");
    if (game && game.versions.length === 0) {
      await prisma.game.update({
        where: { id: game.id },
        data: { versions: { connect: [{ id: standard.id }] } },
      });
      console.log(`${title}: Standard linked`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
