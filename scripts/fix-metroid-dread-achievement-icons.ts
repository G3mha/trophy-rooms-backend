/**
 * Set icons on the Metroid Dread completionist set.
 *
 * Switch has no native achievements, so the set was written by hand and had no
 * icons. These are square crops of Nintendo's own art (the Metroid Dread
 * Report series on metroid.nintendo.com, Nintendo UK's game page and IGDB),
 * hosted on the Cloudflare R2 bucket behind assets.trophyrooms.org. File
 * names carry a content hash, so a re-cropped icon gets a new URL instead of
 * a stale cache.
 *
 * 14 icons show what their achievement is about. Experiment No. Z-57,
 * Golzuna, Elun and Hanubia never appear in promotional art, so those use
 * crops of the Chozo Memories paintings, and the clear-time, Hard Mode and
 * rush achievements use Samus and key art.
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

const FAMILY_TITLE = "Metroid Dread";
const ICON_BASE = "https://assets.trophyrooms.org/achievements/metroid-dread/";

const ICONS: Record<string, string> = {
  "Out of Sight": "out-of-sight-b5f4b133.webp",
  "Old Rival": "old-rival-ea4fb239.webp",
  "Deep Water": "deep-water-009ff2b2.webp",
  "Storm Front": "storm-front-50c3f061.webp",
  "Failed Experiment": "failed-experiment-6b3d3149.webp",
  "Crossed Out": "crossed-out-c81e828c.webp",
  "See You Next Mission": "see-you-next-mission-306212c6.webp",
  "Turning the Tables": "turning-the-tables-f0729b96.webp",
  "Extermination": "extermination-309e8a5f.webp",
  "Artaria Archive": "artaria-archive-fc2973c3.webp",
  "Cataris Archive": "cataris-archive-fb1d7fae.webp",
  "Dairon Archive": "dairon-archive-dbdca2f7.webp",
  "Burenia Archive": "burenia-archive-09d37b99.webp",
  "Ghavoran Archive": "ghavoran-archive-a2a68ca5.webp",
  "Elun Archive": "elun-archive-10873bab.webp",
  "Ferenia Archive": "ferenia-archive-2650c9ab.webp",
  "Hanubia Archive": "hanubia-archive-5da4e1b4.webp",
  "Full Archive": "full-archive-3485668e.webp",
  "Quick Study": "quick-study-09a8dfaf.webp",
  "Speedrunner": "speedrunner-a037098c.webp",
  "Hard Target": "hard-target-7f1a7148.webp",
  "Hard and Fast": "hard-and-fast-671ece6b.webp",
  "No Time to Spare": "no-time-to-spare-a8578829.webp",
  "Fear Itself": "fear-itself-ef126c0a.webp",
  "Gauntlet": "gauntlet-4667a60e.webp",
  "Untouchable": "untouchable-5d2c879b.webp",
  "Last Metroid": "last-metroid-8cf92520.webp",
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
