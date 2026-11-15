/**
 * Set icons on Elden Ring's PSN Trophy List.
 *
 * These are the game's own trophy icons from Sony's trophy image server (the
 * PS5 list's 512px versions, NPWR25067_00). Each one is a figure on a plinth
 * over black with no ring of its own, so nothing is cropped: they are only
 * scaled to 256px and hosted on the Cloudflare R2 bucket behind
 * assets.trophyrooms.org. File names carry a content hash, so a replaced icon
 * gets a new URL instead of a stale cache.
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

const FAMILY_TITLE = "Elden Ring";
const ICON_BASE = "https://assets.trophyrooms.org/achievements/elden-ring/";

const ICONS: Record<string, string> = {
  "Elden Ring": "elden-ring-29835fea.webp",
  "Elden Lord": "elden-lord-2b39839d.webp",
  "Age of the Stars": "age-of-the-stars-0e0c608e.webp",
  "Lord of Frenzied Flame": "lord-of-frenzied-flame-c39321ce.webp",
  "Shardbearer Godrick": "shardbearer-godrick-3871f1db.webp",
  "Shardbearer Radahn": "shardbearer-radahn-8ecfe288.webp",
  "Shardbearer Morgott": "shardbearer-morgott-1a25b2a4.webp",
  "Shardbearer Rykard": "shardbearer-rykard-4d2e7884.webp",
  "Shardbearer Malenia": "shardbearer-malenia-8f98971c.webp",
  "Shardbearer Mohg": "shardbearer-mohg-59f2ef79.webp",
  "Maliketh the Black Blade": "maliketh-the-black-blade-62c24af5.webp",
  "Hoarah Loux, Warrior": "hoarah-loux-warrior-0db7ccae.webp",
  "Dragonlord Placidusax": "dragonlord-placidusax-40f961b1.webp",
  "God-Slaying Armament": "god-slaying-armament-0319460d.webp",
  "Legendary Armaments": "legendary-armaments-51158586.webp",
  "Legendary Ashen Remains": "legendary-ashen-remains-edc77576.webp",
  "Legendary Sorceries and Incantations": "legendary-sorceries-and-incantations-8b344db6.webp",
  "Legendary Talismans": "legendary-talismans-107bb896.webp",
  "Rennala, Queen of the Full Moon": "rennala-queen-of-the-full-moon-cc1d1fc9.webp",
  "Lichdragon Fortissax": "lichdragon-fortissax-2746c5c1.webp",
  "Godskin Duo": "godskin-duo-f69a9102.webp",
  "Fire Giant": "fire-giant-e457f2cb.webp",
  "Dragonkin Soldier of Nokstella": "dragonkin-soldier-of-nokstella-be0044fa.webp",
  "Regal Ancestor Spirit": "regal-ancestor-spirit-8d159a02.webp",
  "Valiant Gargoyles": "valiant-gargoyles-457f04b4.webp",
  "Margit, the Fell Omen": "margit-the-fell-omen-eb1ff78c.webp",
  "Red Wolf of Radagon": "red-wolf-of-radagon-46ab898d.webp",
  "Godskin Noble": "godskin-noble-8ec9f2f4.webp",
  "Magma Wyrm Makar": "magma-wyrm-makar-a9d71dbf.webp",
  "Godfrey, First Elden Lord": "godfrey-first-elden-lord-1b6945a9.webp",
  "Mohg, the Omen": "mohg-the-omen-c7d877b0.webp",
  "Mimic Tear": "mimic-tear-75eba2b7.webp",
  "Loretta, Knight of the Haligtree": "loretta-knight-of-the-haligtree-fb9ff4d4.webp",
  "Astel, Naturalborn of the Void": "astel-naturalborn-of-the-void-ec2c8822.webp",
  "Leonine Misbegotten": "leonine-misbegotten-186c9da4.webp",
  "Royal Knight Loretta": "royal-knight-loretta-56ae1e0e.webp",
  "Elemer of the Briar": "elemer-of-the-briar-466835f5.webp",
  "Ancestor Spirit": "ancestor-spirit-1bd2ecf7.webp",
  "Commander Niall": "commander-niall-bc4826c2.webp",
  "Roundtable Hold": "roundtable-hold-890f4bda.webp",
  "Great Rune": "great-rune-bba56a7a.webp",
  "Erdtree Aflame": "erdtree-aflame-10a6a256.webp",
};

async function main() {
  const apply = process.argv.includes("--apply");

  const achievements = await prisma.achievement.findMany({
    where: {
      title: { in: Object.keys(ICONS) },
      achievementSet: { type: "OFFICIAL", gameFamily: { title: FAMILY_TITLE } },
    },
    select: { id: true, title: true, iconUrl: true },
  });

  const found = new Set(achievements.map((a) => a.title));
  const missing = Object.keys(ICONS).filter((title) => !found.has(title));
  if (missing.length > 0) {
    throw new Error(`Achievements not found in the ${FAMILY_TITLE} sets: ${missing.join(", ")}`);
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
