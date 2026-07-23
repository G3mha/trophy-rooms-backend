/**
 * Populate the new per-game description override for same-family remakes
 * whose pages showed the original's text: Link's Awakening (Switch 2019),
 * Metroid Prime (Switch Remastered), Paper Mario: The Thousand-Year Door
 * (Switch 2024), Mario vs. Donkey Kong (Switch 2024). Each pulls the
 * remake's own IGDB summary.
 */

import { PrismaClient } from "@prisma/client";
import { igdbRequest, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

const TARGETS: Array<{
  familyTitle: string;
  platformSlug: string;
  igdbName: string;
  year: number;
}> = [
  {
    familyTitle: "The Legend of Zelda: Link's Awakening",
    platformSlug: "switch",
    igdbName: "The Legend of Zelda: Link's Awakening",
    year: 2019,
  },
  {
    familyTitle: "Metroid Prime",
    platformSlug: "switch",
    igdbName: "Metroid Prime Remastered",
    year: 2023,
  },
  {
    familyTitle: "Paper Mario: The Thousand-Year Door",
    platformSlug: "switch",
    igdbName: "Paper Mario: The Thousand-Year Door",
    year: 2024,
  },
  {
    familyTitle: "Mario vs. Donkey Kong",
    platformSlug: "switch",
    igdbName: "Mario vs. Donkey Kong",
    year: 2024,
  },
];

async function main() {
  for (const target of TARGETS) {
    const game = await prisma.game.findFirst({
      where: {
        gameFamily: { title: { equals: target.familyTitle, mode: "insensitive" } },
        platform: { slug: target.platformSlug },
      },
    });
    if (!game) {
      console.log(`${target.familyTitle} ${target.platformSlug}: game not found`);
      continue;
    }
    if (game.description) {
      console.log(`${target.familyTitle}: already has override`);
      continue;
    }
    const escaped = target.igdbName.replace(/"/g, '\\"');
    const from = Math.floor(new Date(`${target.year}-01-01`).getTime() / 1000);
    const to = Math.floor(new Date(`${target.year + 1}-06-01`).getTime() / 1000);
    const results = await igdbRequest<IGDBGame[]>(
      "games",
      `fields id, name, slug, summary, first_release_date;
       where name = "${escaped}" & first_release_date >= ${from} & first_release_date < ${to};
       limit 5;`
    );
    const igdb = results[0] ?? null;
    if (!igdb?.summary) {
      console.log(`${target.familyTitle}: no IGDB summary found`);
      continue;
    }
    await prisma.game.update({
      where: { id: game.id },
      data: { description: igdb.summary },
    });
    console.log(`${target.familyTitle} ${target.platformSlug}: description set (${igdb.slug})`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
