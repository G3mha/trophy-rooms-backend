/**
 * Gap check: notable 2025-2026 releases vs what the DB already has.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CANDIDATES = [
  "Mario Kart World",
  "Donkey Kong Bananza",
  "Nintendo Switch 2 Welcome Tour",
  "Drag x Drive",
  "Hyrule Warriors: Age of Imprisonment",
  "Kirby Air Riders",
  "Metroid Prime 4",
  "Pokémon Legends: Z-A",
  "Pokémon Champions",
  "Pokémon Pokopia",
  "Animal Crossing: New Horizons",
  "Mario Tennis Fever",
  "Super Mario Bros. Wonder",
  "Star Fox",
  "Fire Emblem: Fortune's Weave",
  "Splatoon Raiders",
  "Nintendo Switch Sports Resort",
  "Ocarina of Time",
  "Tomodachi Life",
  "Rhythm Heaven Groove",
  "Final Fantasy VII Remake",
  "Final Fantasy VII Rebirth",
  "Dragon Quest VII",
  "Dragon Quest I & II",
  "Yakuza Kiwami 3",
  "Elden Ring",
  "The Duskbloods",
  "Hollow Knight: Silksong",
  "Hades II",
  "007 First Light",
  "Death Stranding 2",
  "Ghost of Yotei",
  "Grand Theft Auto VI",
  "Mario Party Jamboree",
  "Kirby and the Forgotten Land",
];

async function main() {
  for (const title of CANDIDATES) {
    const family = await prisma.gameFamily.findFirst({
      where: { title: { contains: title, mode: "insensitive" } },
      include: { games: { include: { platform: { select: { slug: true } } } } },
    });
    if (!family) {
      console.log(`MISSING  ${title}`);
    } else {
      const platforms = family.games.map((g) => g.platform?.slug).join(",");
      console.log(`exists   ${title}  ->  "${family.title}" [${platforms}]`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
