/**
 * Ace Attorney follow-up (2026-07-23).
 *
 * 1. The collection bundles had no per-family Games on their platforms, so
 *    the add-bundle-to-library cascade had nothing to add. Create
 *    compilation-carrier Games (no standalone versions) per the
 *    small-compilation rule:
 *    - PW trilogy members on 3DS (2014-04-17 JP) + Switch/PS4/XB1/Steam
 *      (2019-04-09)
 *    - Apollo trilogy members on Switch/PS4/XB1/Steam (2024-01-25)
 *    - AA Investigations on Switch/PS4/XB1/Steam (2024-09-06)
 *    - Great Ace Attorney games on Steam (2021-07-27)
 *    Owning the bundle then populates the Library with these games; the
 *    Library's "played on" platform can be Switch 2 via backward compat
 *    (UserGame.platformId is independent of the game's native platform).
 *
 * 2. Repair missing covers/descriptions on the five AA bundles - the
 *    Trilogy's IGDB entry dates to 2014, outside the original lookup
 *    window.
 */

import { PrismaClient } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

async function igdbByName(name: string): Promise<IGDBGame | null> {
  try {
    const escaped = name.replace(/"/g, '\\"');
    const [game] = await igdbRequest<IGDBGame[]>(
      "games",
      `fields id, name, slug, summary, cover.image_id, first_release_date;
       where name = "${escaped}"; limit 5;`
    );
    return game ?? null;
  } catch {
    return null;
  }
}

async function addCarrier(familyTitle: string, platformSlug: string, date: string) {
  const family = await prisma.gameFamily.findFirst({
    where: { title: { equals: familyTitle, mode: "insensitive" } },
  });
  const platform = await prisma.platform.findUnique({ where: { slug: platformSlug } });
  if (!family || !platform) {
    console.log(`${familyTitle} ${platformSlug}: family or platform missing`);
    return;
  }
  const existing = await prisma.game.findFirst({
    where: { gameFamilyId: family.id, platformId: platform.id },
  });
  if (existing) {
    console.log(`${familyTitle} ${platformSlug}: already exists`);
    return;
  }
  // Compilation-only carrier: no standalone versions (the bundle is the
  // ownable unit)
  await prisma.game.create({
    data: {
      gameFamilyId: family.id,
      platformId: platform.id,
      releaseDate: new Date(date),
    },
  });
  console.log(`${familyTitle} ${platformSlug}: carrier created`);
}

async function main() {
  console.log("=== Ace Attorney carriers + bundle covers ===\n");

  const pwTrilogy = [
    "Phoenix Wright: Ace Attorney",
    "Phoenix Wright: Ace Attorney - Justice for All",
    "Phoenix Wright: Ace Attorney - Trials and Tribulations",
  ];
  for (const title of pwTrilogy) {
    await addCarrier(title, "3ds", "2014-04-17");
    for (const slug of ["switch", "ps4", "xbox-one", "steam"]) {
      await addCarrier(title, slug, "2019-04-09");
    }
  }

  const ajTrilogy = [
    "Apollo Justice: Ace Attorney",
    "Phoenix Wright: Ace Attorney - Dual Destinies",
    "Phoenix Wright: Ace Attorney - Spirit of Justice",
  ];
  for (const title of ajTrilogy) {
    for (const slug of ["switch", "ps4", "xbox-one", "steam"]) {
      await addCarrier(title, slug, "2024-01-25");
    }
  }

  for (const slug of ["switch", "ps4", "xbox-one", "steam"]) {
    await addCarrier("Ace Attorney Investigations: Miles Edgeworth", slug, "2024-09-06");
  }

  for (const title of ["The Great Ace Attorney: Adventures", "The Great Ace Attorney 2: Resolve"]) {
    await addCarrier(title, "steam", "2021-07-27");
  }

  // --- Bundle cover repairs ---
  console.log("");
  const bundles = await prisma.bundle.findMany({
    where: { name: { contains: "Ace Attorney", mode: "insensitive" } },
  });
  for (const bundle of bundles) {
    if (bundle.coverUrl) {
      console.log(`${bundle.name}: cover present`);
      continue;
    }
    const igdb = await igdbByName(bundle.name);
    if (igdb?.cover?.image_id) {
      await prisma.bundle.update({
        where: { id: bundle.id },
        data: {
          coverUrl: getCoverUrl(igdb.cover.image_id, "cover_big"),
          description: bundle.description ?? igdb.summary ?? null,
        },
      });
      console.log(`${bundle.name}: cover repaired (${igdb.slug})`);
    } else {
      console.log(`${bundle.name}: no IGDB match`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
