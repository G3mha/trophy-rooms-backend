/**
 * Batman pass follow-up: PC/Steam entries + last-gen SKUs (2026-07-29).
 *
 * Steam releases (NA dates):
 * - Batman: Arkham Asylum        2009-09-15 (PC came ~3 weeks after consoles)
 * - Batman: Arkham City          2011-11-22 (PC delayed from the Oct console launch)
 * - Batman: Arkham Origins       2013-10-25 (day-and-date)
 * - Batman: Arkham Knight        2015-06-23 (day-and-date)
 * - Batman: The Telltale Series  2016-08-02 (day-and-date with PS4/XB1)
 * - Batman: The Enemy Within     2017-08-08 (day-and-date)
 * - LEGO Batman 1/2/3            2008-09-23 / 2012-06-19 / 2014-11-11 (day-and-date)
 * Asylum/City Steam games also connect the shared GOTY version, matching
 * their PS3/X360 rows.
 *
 * Batman: Arkham Origins Blackgate - Deluxe Edition (2014-04-01 NA):
 * digital-only port of the Vita/3DS game to PS3/X360/Wii U/Steam. Per-family
 * "Deluxe Edition" version (single-family, carries art) + platform cover
 * overrides on the four new games.
 *
 * Batman: The Telltale Series on PS3/X360: NA retail 2016-09-13.
 * (The Enemy Within never shipped on PS3/X360 - not added.)
 */

import { PrismaClient } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

async function igdbCover(slugs: string[]): Promise<string | null> {
  for (const slug of slugs) {
    try {
      const [igdb] = await igdbRequest<IGDBGame[]>(
        "games",
        `fields id, slug, cover.image_id; where slug = "${slug}"; limit 1;`
      );
      if (igdb?.cover?.image_id) {
        return getCoverUrl(igdb.cover.image_id, "cover_big");
      }
    } catch {
      // try next
    }
  }
  return null;
}

async function addGame(opts: {
  familyTitle: string;
  platformSlug: string;
  date: string;
  coverUrl?: string | null;
  versionSlugs?: string[];
}) {
  const fam = await prisma.gameFamily.findFirst({
    where: { title: { equals: opts.familyTitle, mode: "insensitive" } },
  });
  const platform = await prisma.platform.findUnique({ where: { slug: opts.platformSlug } });
  if (!fam || !platform) {
    console.log(`${opts.familyTitle} ${opts.platformSlug}: missing family or platform, skipped`);
    return;
  }
  const existing = await prisma.game.findFirst({
    where: { gameFamilyId: fam.id, platformId: platform.id },
  });
  if (existing) {
    console.log(`${opts.familyTitle} ${opts.platformSlug}: already exists`);
    return;
  }
  const versions = await prisma.gameVersion.findMany({
    where: { slug: { in: opts.versionSlugs ?? ["standard"] } },
    select: { id: true },
  });
  await prisma.game.create({
    data: {
      gameFamilyId: fam.id,
      platformId: platform.id,
      releaseDate: new Date(opts.date),
      coverUrl: opts.coverUrl ?? null,
      versions: { connect: versions.map((v) => ({ id: v.id })) },
    },
  });
  console.log(`${opts.familyTitle} ${opts.platformSlug}: created${opts.coverUrl ? " (with art)" : ""}`);
}

async function main() {
  console.log("=== Batman PC/Steam + last-gen SKUs ===\n");

  // --- Steam entries ---
  const STEAM = [
    { familyTitle: "Batman: Arkham Asylum", date: "2009-09-15", versionSlugs: ["standard", "game-of-the-year-edition"] },
    { familyTitle: "Batman: Arkham City", date: "2011-11-22", versionSlugs: ["standard", "game-of-the-year-edition"] },
    { familyTitle: "Batman: Arkham Origins", date: "2013-10-25" },
    { familyTitle: "Batman: Arkham Knight", date: "2015-06-23" },
    { familyTitle: "Batman: The Telltale Series", date: "2016-08-02" },
    { familyTitle: "Batman: The Enemy Within", date: "2017-08-08" },
    { familyTitle: "LEGO Batman: The Videogame", date: "2008-09-23" },
    { familyTitle: "LEGO Batman 2: DC Super Heroes", date: "2012-06-19" },
    { familyTitle: "LEGO Batman 3: Beyond Gotham", date: "2014-11-11" },
  ];
  for (const entry of STEAM) {
    await addGame({ ...entry, platformSlug: "steam" });
  }

  // --- Blackgate Deluxe Edition (digital-only PS3/X360/Wii U/Steam) ---
  console.log("");
  const deluxeArt = await igdbCover([
    "batman-arkham-origins-blackgate-deluxe-edition",
    "batman-arkham-origins-blackgate-the-deluxe-edition",
  ]);
  const deluxeSlug = "deluxe-edition-batman-arkham-origins-blackgate";
  let deluxe = await prisma.gameVersion.findUnique({ where: { slug: deluxeSlug } });
  if (!deluxe) {
    deluxe = await prisma.gameVersion.create({
      data: {
        name: "Deluxe Edition",
        slug: deluxeSlug,
        coverUrl: deluxeArt,
        releaseDate: new Date("2014-04-01"),
        isDefault: false,
        digitalOnly: true,
      },
    });
    console.log(`Blackgate Deluxe Edition version created${deluxeArt ? " (with art)" : ""}`);
  }
  for (const platformSlug of ["ps3", "xbox-360", "wii-u", "steam"]) {
    await addGame({
      familyTitle: "Batman: Arkham Origins Blackgate",
      platformSlug,
      date: "2014-04-01",
      coverUrl: deluxeArt,
      versionSlugs: [deluxeSlug],
    });
  }

  // --- Telltale season one on PS3/X360 (NA retail 2016-09-13) ---
  console.log("");
  await addGame({ familyTitle: "Batman: The Telltale Series", platformSlug: "ps3", date: "2016-09-13" });
  await addGame({ familyTitle: "Batman: The Telltale Series", platformSlug: "xbox-360", date: "2016-09-13" });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
