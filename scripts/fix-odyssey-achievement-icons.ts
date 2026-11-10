/**
 * Set icons on the Super Mario Odyssey completionist set.
 *
 * Switch has no native achievements, so the set was written by hand and had no
 * icons. These are square crops of Nintendo's own art (IGDB screenshots,
 * artwork and trailer thumbnails, and Nintendo UK's game page), hosted on the
 * Cloudflare R2 bucket behind assets.trophyrooms.org. File names carry a
 * content hash, so a re-cropped icon gets a new URL instead of a stale cache.
 *
 * 30 of the 46 achievements have an icon. The rest have no matching official
 * art yet and keep the tier medal.
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

const FAMILY_TITLE = "Super Mario Odyssey";
const ICON_BASE = "https://assets.trophyrooms.org/achievements/super-mario-odyssey/";

const ICONS: Record<string, string> = {
  "Bonneton Swept": "bonneton-swept-7ce090ea.webp",
  "Tostarena Swept": "tostarena-swept-610ba23e.webp",
  "Fossil Falls Swept": "fossil-falls-swept-bdcfee94.webp",
  "Steam Gardens Swept": "steam-gardens-swept-5b697950.webp",
  "New Donk City Swept": "new-donk-city-swept-61a24327.webp",
  "Bubblaine Swept": "bubblaine-swept-770eadbb.webp",
  "Mount Volbono Swept": "mount-volbono-swept-17f6a5f7.webp",
  "Honeylune Ridge Swept": "honeylune-ridge-swept-7446a7f0.webp",
  "Hat's Off": "hats-off-10f9b83b.webp",
  "Odyssey Underway": "odyssey-underway-a58a51d9.webp",
  "Wedding Crashed": "wedding-crashed-31f40fff.webp",
  "Jump Up, Super Star!": "jump-up-super-star-fcecd85d.webp",
  "Cappy's First Catch": "cappys-first-catch-803b68ff.webp",
  "Shape Shifter": "shape-shifter-fc4f42ab.webp",
  "Complete Control": "complete-control-58d14065.webp",
  "Moonstruck": "moonstruck-2d516f81.webp",
  "Lunar Hoard": "lunar-hoard-f48be253.webp",
  "Every Moon in the Sky": "every-moon-in-the-sky-84b975b3.webp",
  "Counter Maxed": "counter-maxed-356351f1.webp",
  "New Threads": "new-threads-a42736c3.webp",
  "Fashion Icon": "fashion-icon-2d2d6595.webp",
  "Souvenir Shopper": "souvenir-shopper-1d1f47c7.webp",
  "Fully Furnished": "fully-furnished-3e251079.webp",
  "Peach Hunter": "peach-hunter-7eb9a841.webp",
  "Shiveria Swept": "shiveria-swept-85782480.webp",
  "Crumbleden Swept": "crumbleden-swept-f050ff55.webp",
  "Bowser's Castle Swept": "bowsers-castle-swept-f7ed055a.webp",
  "Volleyball Veteran": "volleyball-veteran-e40ea5a7.webp",
  "Jump-Rope Genius": "jump-rope-genius-89f16b3c.webp",
  "Koopa Freerunner": "koopa-freerunner-e5a83e7d.webp",
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
