/**
 * Set icons on Breath of the Wild's two completionist sets: the base game's
 * Completionist set and the Expansion Pass set.
 *
 * Breath of the Wild has no native achievements, so both sets were written by
 * hand and had no icons. These are square crops of Nintendo's own art from
 * Nintendo UK's game pages, plus IGDB screenshots of the base game and of the
 * two Expansion Pass packs, hosted on the Cloudflare R2 bucket behind
 * assets.trophyrooms.org. File names carry a content hash, so a re-cropped
 * icon gets a new URL instead of a stale cache.
 *
 * 17 icons show what their achievement is about. Koroks, Great Fairies,
 * Lynels, Hinox, Molduga, Kohga and the Master Cycle never appear in
 * promotional art, so those use other scenes from the game.
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

const FAMILY_TITLE = "The Legend of Zelda: Breath of the Wild";
const ICON_BASE = "https://assets.trophyrooms.org/achievements/the-legend-of-zelda-breath-of-the-wild/";

const ICONS: Record<string, string> = {
  "Off the Plateau": "off-the-plateau-2c81e7ea.webp",
  "Mipha's Grace": "miphas-grace-6c217e93.webp",
  "Daruk's Protection": "daruks-protection-c87b252e.webp",
  "Revali's Gale": "revalis-gale-d86fc548.webp",
  "Urbosa's Fury": "urbosas-fury-43f22962.webp",
  "Yiga Takedown": "yiga-takedown-17404af1.webp",
  "Recovered Memories": "recovered-memories-685c0cff.webp",
  "The Sword Chooses You": "the-sword-chooses-you-643d2f1d.webp",
  "Calamity's End": "calamitys-end-ce0add4a.webp",
  "Tower Climber": "tower-climber-9612da5c.webp",
  "Spirit Orbs": "spirit-orbs-3a474df4.webp",
  "Hestu's Gift": "hestus-gift-5fa06fd5.webp",
  "Fairy Godmothers": "fairy-godmothers-d8c69a61.webp",
  "Mapped Out": "mapped-out-ae8867e3.webp",
  "Good Samaritan": "good-samaritan-36d722c6.webp",
  "Trailblazer": "trailblazer-0284dfa9.webp",
  "Classified": "classified-db854552.webp",
  "Dressed to Impress": "dressed-to-impress-ccc918e5.webp",
  "Lynel Hunter": "lynel-hunter-882b413e.webp",
  "Big Game": "big-game-05313f47.webp",
  "Rock Solid": "rock-solid-73da2373.webp",
  "Sand Shark": "sand-shark-494373e2.webp",
  "Champion of Hyrule": "champion-of-hyrule-7240d426.webp",
  "Beginning Trials": "beginning-trials-0275f688.webp",
  "Middle Trials": "middle-trials-3634d746.webp",
  "Blade Awakened": "blade-awakened-052ffe80.webp",
  "Master Mode": "master-mode-babf5dd5.webp",
  "One-Hit Wonder": "one-hit-wonder-e720e49a.webp",
  "Blight Rematch": "blight-rematch-1376f8c0.webp",
  "Master Cycle": "master-cycle-37b247b9.webp",
};

async function main() {
  const apply = process.argv.includes("--apply");

  const achievements = await prisma.achievement.findMany({
    where: {
      title: { in: Object.keys(ICONS) },
      achievementSet: { type: "COMPLETIONIST", gameFamily: { title: FAMILY_TITLE } },
    },
    select: { id: true, title: true, iconUrl: true },
  });

  const found = new Set(achievements.map((a) => a.title));
  const missing = Object.keys(ICONS).filter((title) => !found.has(title));
  if (missing.length > 0) {
    throw new Error(`Achievements not found in the ${FAMILY_TITLE} set: ${missing.join(", ")}`);
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
