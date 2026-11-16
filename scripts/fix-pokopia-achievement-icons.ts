/**
 * Set icons on Pokémon Pokopia's two hand-authored lists: the Completionist
 * list and the Expansion Pass.
 *
 * Pokopia has no platform achievements, so these are square crops of official
 * art: the Pokopia site (pokopia.pokemon.com), Nintendo's store page, and IGDB
 * for Bubbly Basin. The official art doesn't show Articuno, Zapdos, Moltres,
 * Lugia, Ho-Oh, Volcanion, Mewtwo, Mew or Phione in Pokopia, so those icons
 * use the official Pokédex art from pokemon.com over blurred Pokopia
 * backgrounds. Nine entries with no matching art (badges, the rocket launch,
 * the diploma, fossils, Human Records and a few regions) get their own
 * stand-in scene. Everything is 256px and hosted on the Cloudflare R2 bucket
 * behind assets.trophyrooms.org. File names carry a content hash, so a
 * replaced icon gets a new URL instead of a stale cache.
 *
 * Dry run by default. Pass --apply to write. Every URL is checked before
 * anything is written, so a missing upload can't leave a broken icon.
 */

import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile?.();
} catch {
  // Ignore missing env file in deployed environments.
}

const prisma = new PrismaClient();

const FAMILY_TITLE = "Pokémon Pokopia";
const SET_TITLES = ["Completionist list", "Expansion Pass"];
const ICON_BASE = "https://assets.trophyrooms.org/achievements/pokemon-pokopia/";

const ICONS: Record<string, string> = {
  // Completionist list
  "Rainmaker": "rainmaker-d7271cab.webp",
  "Power Up": "power-up-906d3e84.webp",
  "Party Starter": "party-starter-8d3f134d.webp",
  "Skyscraper": "skyscraper-dea3d9f4.webp",
  "Open for Business": "open-for-business-6b0fd584.webp",
  "Badge Case": "badge-case-84168ab0.webp",
  "Blast Off": "blast-off-c4916a67.webp",
  "Magnetic Personality": "magnetic-personality-87a7e31c.webp",
  "Wasteland Bloom": "wasteland-bloom-469cf6d8.webp",
  "Bright Beach": "bright-beach-7b3a8ac2.webp",
  "Ridge Revival": "ridge-revival-c050ef64.webp",
  "Sky High": "sky-high-3be23dc3.webp",
  "Town Pride": "town-pride-570e6a4b.webp",
  "Making Friends": "making-friends-1590c51d.webp",
  "Halfway Home": "halfway-home-232102c0.webp",
  "Full Pokédex": "full-pokedex-44961c10.webp",
  "Diploma": "diploma-13446df1.webp",
  "Habitat Expert": "habitat-expert-73d793dd.webp",
  "Bird Watching": "bird-watching-71d22275.webp",
  "Legendary Beasts": "legendary-beasts-72d73590.webp",
  "Tidal Bell": "tidal-bell-6cd31cbf.webp",
  "Clear Bell": "clear-bell-d9714cac.webp",
  "Encore": "encore-fa49f8d4.webp",
  "Dream Guest": "dream-guest-d7f28513.webp",
  "Picture Perfect": "picture-perfect-21bec717.webp",
  "Sweet Dreams": "sweet-dreams-d712bbac.webp",
  "Fossil Record": "fossil-record-20bdaa2a.webp",
  "Greatest Hits": "greatest-hits-8d15d1fe.webp",
  "Paper Trail": "paper-trail-63b543c2.webp",
  "Pokémon Paradise": "pokemon-paradise-ac16990a.webp",

  // Expansion Pass
  "Ocean Temple": "ocean-temple-619b115f.webp",
  "Basin Pokédex": "basin-pokedex-fb66580a.webp",
  "Reef Builder": "reef-builder-837d1eeb.webp",
  "X Marks the Spot": "x-marks-the-spot-5c7625a8.webp",
  "Sea Dreamer": "sea-dreamer-758203f1.webp",
  "Basin in Bloom": "basin-in-bloom-71a3756f.webp",
};

async function main() {
  const apply = process.argv.includes("--apply");

  const achievements = await prisma.achievement.findMany({
    where: {
      title: { in: Object.keys(ICONS) },
      achievementSet: { type: "COMPLETIONIST", title: { in: SET_TITLES }, gameFamily: { title: FAMILY_TITLE } },
    },
    select: { id: true, title: true, iconUrl: true },
  });

  const found = new Set(achievements.map((a) => a.title));
  const missing = Object.keys(ICONS).filter((title) => !found.has(title));
  if (missing.length > 0) {
    throw new Error(`Achievements not found in the ${FAMILY_TITLE} lists: ${missing.join(", ")}`);
  }
  if (achievements.length !== Object.keys(ICONS).length) {
    throw new Error(`Expected ${Object.keys(ICONS).length} achievements, found ${achievements.length}`);
  }

  for (const file of Object.values(ICONS)) {
    const response = await fetch(ICON_BASE + file, { method: "HEAD" });
    if (!response.ok) {
      throw new Error(`Icon not reachable (${response.status}): ${ICON_BASE + file}`);
    }
  }

  const changes = achievements.filter((a) => a.iconUrl !== ICON_BASE + ICONS[a.title]);
  console.log(`${changes.length} of ${achievements.length} achievements need an icon update`);

  if (!apply) {
    for (const a of changes) console.log(`  would set ${a.title} -> ${ICONS[a.title]}`);
    console.log("Dry run. Pass --apply to write.");
    return;
  }

  for (const a of changes) {
    await prisma.achievement.update({
      where: { id: a.id },
      data: { iconUrl: ICON_BASE + ICONS[a.title] },
    });
  }
  console.log(`Updated ${changes.length} achievements`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
