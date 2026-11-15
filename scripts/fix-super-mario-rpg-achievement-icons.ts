/**
 * Set icons on the Super Mario RPG (2023 Switch remake) completionist set.
 *
 * Switch has no native achievements, so the set was written by hand and had no
 * icons. These are square crops of Nintendo's own art (IGDB screenshots and
 * artwork, and Nintendo UK's game page), hosted on the Cloudflare R2 bucket
 * behind assets.trophyrooms.org. File names carry a content hash, so a
 * re-cropped icon gets a new URL instead of a stale cache.
 *
 * 22 icons show what their achievement is about. The other 12 have no
 * matching official art, so each gets its own tile of the promotional art,
 * picked so no two repeat.
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

const FAMILY_TITLE = "Super Mario RPG";
const ICON_BASE = "https://assets.trophyrooms.org/achievements/super-mario-rpg-2023/";

const ICONS: Record<string, string> = {
  "Castle Cleanup": "castle-cleanup-79742a3b.webp",
  "Out of the Woods": "out-of-the-woods-cef5bc9b.webp",
  "Mine Blast": "mine-blast-0bd2613d.webp",
  "Wishing Star": "wishing-star-10bbe462.webp",
  "High Tide": "high-tide-73fcf503.webp",
  "Rangers Down": "rangers-down-ed23bf05.webp",
  "Star Road Restored": "star-road-restored-a8cab3a8.webp",
  "New Sensei": "new-sensei-a42f58f3.webp",
  "Crystal Clear": "crystal-clear-97e77e01.webp",
  "Sore Throat": "sore-throat-f340423b.webp",
  "Bigger Bang": "bigger-bang-eac14ca6.webp",
  "Engine Trouble": "engine-trouble-d896b491.webp",
  "Cake Walk": "cake-walk-e226b569.webp",
  "Walk the Plank": "walk-the-plank-d1ccfaea.webp",
  "Master Class": "master-class-9d894f44.webp",
  "Third Dimension": "third-dimension-f0c51904.webp",
  "Finders Keepers": "finders-keepers-3b0efe2c.webp",
  "Every Last Chest": "every-last-chest-cc0754cd.webp",
  "Know Your Enemy": "know-your-enemy-7b528434.webp",
  "Memory Lane": "memory-lane-178bfee5.webp",
  "Encore": "encore-e68039da.webp",
  "Spring Loaded": "spring-loaded-cc96e4a0.webp",
  "Super Suited": "super-suited-2a078717.webp",
  "Full Party": "full-party-85ee8bd0.webp",
  "Midas Touch": "midas-touch-d3b82ca3.webp",
  "Thump Champ": "thump-champ-3bfae066.webp",
  "Off the Rails": "off-the-rails-94cd6db3.webp",
  "Beetle Racer": "beetle-racer-dc290bef.webp",
  "Sky High": "sky-high-7d1abf8b.webp",
  "Bug Out": "bug-out-0e48deb6.webp",
  "Juggling Act": "juggling-act-988ffe88.webp",
  "Total Recall": "total-recall-6b1caddc.webp",
  "Look Away": "look-away-4836c758.webp",
  "Legend of the Seven Stars": "legend-of-the-seven-stars-4461bcd9.webp",
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
