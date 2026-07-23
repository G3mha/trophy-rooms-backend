/**
 * Import the Sifu retail editions for Nintendo Switch (Microids, 2022-11-08):
 *
 * - Vengeance Edition: game + exclusive SteelBook + "The Art of Sifu" print
 *   artbook + original game score (digital) + 3 lithographs
 * - Redemption Edition: game + exclusive SteelBook + original game score
 *   (digital) + 3 lithographs + the Redemption Set items (8-inch Student
 *   figurine, tenacity pendant, 160-page "Behind the Art of Sifu" diary)
 *
 * Modeled as GameVersions on the existing Switch Sifu game, with edition
 * box art from IGDB. Also fixes the Switch game's release date, which
 * carried the PlayStation launch date (Sifu hit Switch on 2022-11-08).
 */

import { PrismaClient } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

const SWITCH_RELEASE_DATE = new Date("2022-11-08");

const EDITIONS = [
  {
    name: "Vengeance Edition",
    slug: "vengeance-edition",
    igdbSlug: "sifu-vengeance-edition",
    description:
      "Physical Switch edition by Microids: the game, an exclusive SteelBook case, 'The Art of Sifu' print artbook, the original game score (digital), and 3 lithographs.",
  },
  {
    name: "Redemption Edition",
    slug: "redemption-edition",
    igdbSlug: "sifu-redemption-edition",
    description:
      "Physical Switch edition by Microids: the game, an exclusive SteelBook, the original game score (digital), 3 lithographs, plus the Redemption Set items - an 8-inch Student figurine, a tenacity pendant, and the 160-page 'Behind the Art of Sifu' developers diary.",
  },
];

async function main() {
  console.log("=== Import Sifu Switch retail editions ===\n");

  const switchGame = await prisma.game.findFirst({
    where: {
      gameFamily: { title: { equals: "Sifu", mode: "insensitive" } },
      platform: { slug: "switch" },
    },
  });
  if (!switchGame) {
    console.error("Sifu Switch game entry not found");
    return;
  }
  console.log(`Found Switch game: ${switchGame.id}`);

  // The Switch release date was seeded with the PlayStation launch date
  if (switchGame.releaseDate?.getTime() !== SWITCH_RELEASE_DATE.getTime()) {
    await prisma.game.update({
      where: { id: switchGame.id },
      data: { releaseDate: SWITCH_RELEASE_DATE },
    });
    console.log("Fixed Switch release date to 2022-11-08");
  }

  for (const edition of EDITIONS) {
    // Edition box art from IGDB
    const [igdbGame] = await igdbRequest<IGDBGame[]>(
      "games",
      `fields id, name, slug, cover.image_id;
       where slug = "${edition.igdbSlug}"; limit 1;`
    );
    const coverUrl = igdbGame?.cover?.image_id
      ? getCoverUrl(igdbGame.cover.image_id, "cover_big")
      : null;
    console.log(
      `\n${edition.name}: IGDB ${igdbGame ? "found" : "not found"}${coverUrl ? " (with cover)" : ""}`
    );

    let version = await prisma.gameVersion.findUnique({
      where: { slug: edition.slug },
    });
    if (!version) {
      version = await prisma.gameVersion.create({
        data: {
          name: edition.name,
          slug: edition.slug,
          description: edition.description,
          coverUrl,
          releaseDate: SWITCH_RELEASE_DATE,
          isDefault: false,
        },
      });
      console.log(`Created version: ${version.name}`);
    } else {
      console.log(`Found existing version: ${version.name}`);
    }

    await prisma.game.update({
      where: { id: switchGame.id },
      data: { versions: { connect: [{ id: version.id }] } },
    });
    console.log(`Linked ${edition.name} to the Switch game`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
