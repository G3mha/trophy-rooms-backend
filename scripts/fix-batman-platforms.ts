/**
 * Batman franchise platform-gap pass (2026-07-29).
 *
 * - Batman: The Brave and the Bold - The Videogame: add the NDS release
 *   (shipped alongside the Wii version, NA 2010-09-07)
 * - Batman: Arkham Origins: add PS3 + Xbox 360 (NA 2013-10-25) and correct
 *   the Wii U date to the same day
 * - Batman: Arkham City: add the Wii U "Armored Edition" (NA 2012-11-18)
 *   with its own single-family version + art
 * - Batman: Arkham Trilogy (Switch, 2023-12-01): the existing Switch games
 *   for Asylum/City/Knight carried the original 2009/2011/2015 dates even
 *   though they only shipped via the Trilogy - fix dates, set the Trilogy
 *   box art as their platform cover, and create the COLLECTION bundle
 * - Batman: Return to Arkham (PS4/Xbox One, NA 2016-10-18): add Asylum +
 *   City carrier games with the collection's box art + the bundle
 * - LEGO Batman platform gaps: LB1 NDS, LB2 NDS + Vita, LB3 PS3/X360/3DS/Vita
 * - Batman Forever: add the Genesis release (same game as SNES)
 *
 * Noted, not added: Arkham Origins Blackgate Deluxe Edition (digital-only
 * PS3/X360/Wii U port) and the Telltale seasons' PS3/X360 SKUs.
 */

import { PrismaClient, BundleType } from "@prisma/client";
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

async function family(title: string) {
  return prisma.gameFamily.findFirst({
    where: { title: { equals: title, mode: "insensitive" } },
  });
}

async function addGame(opts: {
  familyTitle: string;
  platformSlug: string;
  date: string;
  coverUrl?: string | null;
  versionSlug?: string;
}) {
  const fam = await family(opts.familyTitle);
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
  const version = await prisma.gameVersion.findUnique({
    where: { slug: opts.versionSlug ?? "standard" },
  });
  await prisma.game.create({
    data: {
      gameFamilyId: fam.id,
      platformId: platform.id,
      releaseDate: new Date(opts.date),
      coverUrl: opts.coverUrl ?? null,
      ...(version ? { versions: { connect: [{ id: version.id }] } } : {}),
    },
  });
  console.log(`${opts.familyTitle} ${opts.platformSlug}: created${opts.coverUrl ? " (with art)" : ""}`);
}

async function fixSwitchCarrier(familyTitle: string, date: string, coverUrl: string | null) {
  const fam = await family(familyTitle);
  const platform = await prisma.platform.findUnique({ where: { slug: "switch" } });
  if (!fam || !platform) return;
  const game = await prisma.game.findFirst({
    where: { gameFamilyId: fam.id, platformId: platform.id },
  });
  if (!game) {
    console.log(`${familyTitle} switch: not found, skipped`);
    return;
  }
  await prisma.game.update({
    where: { id: game.id },
    data: {
      releaseDate: new Date(date),
      ...(coverUrl ? { coverUrl } : {}),
    },
  });
  console.log(`${familyTitle} switch: date -> ${date}${coverUrl ? ", Trilogy art set" : ""}`);
}

async function createBundle(opts: {
  name: string;
  slug: string;
  coverUrl: string | null;
  description?: string | null;
  date: string;
  platforms: string[];
  familyTitles: string[];
}) {
  const existing = await prisma.bundle.findUnique({ where: { slug: opts.slug } });
  if (existing) {
    console.log(`${opts.name}: bundle already exists`);
    return;
  }
  const families = await prisma.gameFamily.findMany({
    where: {
      OR: opts.familyTitles.map((t) => ({ title: { equals: t, mode: "insensitive" as const } })),
    },
    select: { id: true },
  });
  if (families.length !== opts.familyTitles.length) {
    console.error(`${opts.name}: only ${families.length}/${opts.familyTitles.length} members, skipped`);
    return;
  }
  const platformIds: string[] = [];
  for (const slug of opts.platforms) {
    const p = await prisma.platform.findUnique({ where: { slug } });
    if (p) platformIds.push(p.id);
  }
  await prisma.bundle.create({
    data: {
      name: opts.name,
      slug: opts.slug,
      type: BundleType.COLLECTION,
      description: opts.description ?? null,
      coverUrl: opts.coverUrl,
      releaseDate: new Date(opts.date),
      platforms: { connect: platformIds.map((id) => ({ id })) },
      gameFamilies: { connect: families.map((f) => ({ id: f.id })) },
    },
  });
  console.log(`Created bundle: ${opts.name}${opts.coverUrl ? " (with art)" : ""}`);
}

async function main() {
  console.log("=== Batman platform-gap pass ===\n");

  // --- Batman: The Brave and the Bold (NDS companion release) ---
  await addGame({
    familyTitle: "Batman: The Brave and the Bold - The Videogame",
    platformSlug: "nds",
    date: "2010-09-07",
  });

  // --- Batman: Arkham Origins (PS3 / Xbox 360 + Wii U date) ---
  await addGame({ familyTitle: "Batman: Arkham Origins", platformSlug: "ps3", date: "2013-10-25" });
  await addGame({ familyTitle: "Batman: Arkham Origins", platformSlug: "xbox-360", date: "2013-10-25" });
  const origins = await family("Batman: Arkham Origins");
  if (origins) {
    const wiiU = await prisma.platform.findUnique({ where: { slug: "wii-u" } });
    const originsWiiU = wiiU
      ? await prisma.game.findFirst({ where: { gameFamilyId: origins.id, platformId: wiiU.id } })
      : null;
    if (originsWiiU && originsWiiU.releaseDate?.toISOString().split("T")[0] !== "2013-10-25") {
      await prisma.game.update({
        where: { id: originsWiiU.id },
        data: { releaseDate: new Date("2013-10-25") },
      });
      console.log("Batman: Arkham Origins wii-u: date -> 2013-10-25");
    }
  }

  // --- Batman: Arkham City - Armored Edition (Wii U) ---
  console.log("");
  const armoredArt = await igdbCover(["batman-arkham-city-armored-edition"]);
  let armored = await prisma.gameVersion.findUnique({ where: { slug: "armored-edition" } });
  if (!armored) {
    armored = await prisma.gameVersion.create({
      data: {
        name: "Armored Edition",
        slug: "armored-edition",
        coverUrl: armoredArt,
        releaseDate: new Date("2012-11-18"),
        isDefault: false,
      },
    });
    console.log(`Armored Edition version created${armoredArt ? " (with art)" : ""}`);
  }
  await addGame({
    familyTitle: "Batman: Arkham City",
    platformSlug: "wii-u",
    date: "2012-11-18",
    coverUrl: armoredArt,
    versionSlug: "armored-edition",
  });

  // --- Batman: Arkham Trilogy (Switch carriers + bundle) ---
  console.log("");
  const trilogyArt = await igdbCover(["batman-arkham-trilogy"]);
  await fixSwitchCarrier("Batman: Arkham Asylum", "2023-12-01", trilogyArt);
  await fixSwitchCarrier("Batman: Arkham City", "2023-12-01", trilogyArt);
  await fixSwitchCarrier("Batman: Arkham Knight", "2023-12-01", trilogyArt);
  await createBundle({
    name: "Batman: Arkham Trilogy",
    slug: "batman-arkham-trilogy",
    coverUrl: trilogyArt,
    description:
      "Includes Batman: Arkham Asylum, Batman: Arkham City, and Batman: Arkham Knight, plus all DLC, on Nintendo Switch.",
    date: "2023-12-01",
    platforms: ["switch"],
    familyTitles: ["Batman: Arkham Asylum", "Batman: Arkham City", "Batman: Arkham Knight"],
  });

  // --- Batman: Return to Arkham (PS4 / Xbox One remasters + bundle) ---
  console.log("");
  const returnArt = await igdbCover(["batman-return-to-arkham"]);
  for (const platformSlug of ["ps4", "xbox-one"]) {
    await addGame({
      familyTitle: "Batman: Arkham Asylum",
      platformSlug,
      date: "2016-10-18",
      coverUrl: returnArt,
    });
    await addGame({
      familyTitle: "Batman: Arkham City",
      platformSlug,
      date: "2016-10-18",
      coverUrl: returnArt,
    });
  }
  await createBundle({
    name: "Batman: Return to Arkham",
    slug: "batman-return-to-arkham",
    coverUrl: returnArt,
    description:
      "Remastered versions of Batman: Arkham Asylum and Batman: Arkham City, including all DLC, for PS4 and Xbox One.",
    date: "2016-10-18",
    platforms: ["ps4", "xbox-one"],
    familyTitles: ["Batman: Arkham Asylum", "Batman: Arkham City"],
  });

  // --- LEGO Batman platform gaps ---
  console.log("");
  await addGame({ familyTitle: "LEGO Batman: The Videogame", platformSlug: "nds", date: "2008-09-23" });
  await addGame({ familyTitle: "LEGO Batman 2: DC Super Heroes", platformSlug: "nds", date: "2012-06-19" });
  await addGame({ familyTitle: "LEGO Batman 2: DC Super Heroes", platformSlug: "vita", date: "2012-06-19" });
  await addGame({ familyTitle: "LEGO Batman 3: Beyond Gotham", platformSlug: "ps3", date: "2014-11-11" });
  await addGame({ familyTitle: "LEGO Batman 3: Beyond Gotham", platformSlug: "xbox-360", date: "2014-11-11" });
  await addGame({ familyTitle: "LEGO Batman 3: Beyond Gotham", platformSlug: "3ds", date: "2014-11-11" });
  await addGame({ familyTitle: "LEGO Batman 3: Beyond Gotham", platformSlug: "vita", date: "2014-11-11" });

  // --- Batman Forever (Genesis, same game as SNES) ---
  await addGame({ familyTitle: "Batman Forever", platformSlug: "genesis", date: "1995-09-07" });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
