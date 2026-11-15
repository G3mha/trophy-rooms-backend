/**
 * Set icons on the Tears of the Kingdom completionist set.
 *
 * Switch has no native achievements, so the set was written by hand and had no
 * icons. These are square crops of Nintendo's own art from Nintendo UK's game
 * pages (the original and the Switch 2 Edition), hosted on the Cloudflare R2
 * bucket behind assets.trophyrooms.org. Character art is a cutout, so it sits
 * on the game's sky artwork. File names carry a content hash, so a re-cropped
 * icon gets a new URL instead of a stale cache.
 *
 * 10 icons show what their achievement is about. Koroks, Great Fairies,
 * Gleeoks, Lynels, Master Kohga and Mineru never appear in promotional art,
 * so those and the more abstract goals use other scenes from the game.
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

const FAMILY_TITLE = "The Legend of Zelda: Tears of the Kingdom";
const ICON_BASE = "https://assets.trophyrooms.org/achievements/the-legend-of-zelda-tears-of-the-kingdom/";

const ICONS: Record<string, string> = {
  "Wind Rider": "wind-rider-b1425ead.webp",
  "Trial by Fire": "trial-by-fire-6e402ce8.webp",
  "Clean Water": "clean-water-f3b57cc7.webp",
  "Sand Queen": "sand-queen-1ffbe5cd.webp",
  "Spirit Guide": "spirit-guide-0aca6fbb.webp",
  "Tears of the Dragon": "tears-of-the-dragon-49f26071.webp",
  "Sword in the Sky": "sword-in-the-sky-44e1ecf7.webp",
  "Yiga Dismissed": "yiga-dismissed-a7f93493.webp",
  "Demon King's End": "demon-kings-end-9ad7e354.webp",
  "Head in the Clouds": "head-in-the-clouds-3f878c89.webp",
  "Light of Blessing": "light-of-blessing-212208e8.webp",
  "Root and Branch": "root-and-branch-8025e191.webp",
  "Yahaha!": "yahaha-9c03c069.webp",
  "Well Traveled": "well-traveled-e4b7ea81.webp",
  "Frog Prince": "frog-prince-768037e3.webp",
  "Fountain of Youth": "fountain-of-youth-57bbab79.webp",
  "Every Corner": "every-corner-b2215124.webp",
  "Side Tracked": "side-tracked-bb76f470.webp",
  "Odd Jobs": "odd-jobs-531faf55.webp",
  "Shrine Seeker": "shrine-seeker-03ac1182.webp",
  "Picture Perfect": "picture-perfect-9ee068f4.webp",
  "Dressed to Impress": "dressed-to-impress-9a5e85c5.webp",
  "Long Live the King": "long-live-the-king-fb79ebae.webp",
  "Silver Lining": "silver-lining-a6a8f311.webp",
  "Hero of Hyrule": "hero-of-hyrule-3c37bbf0.webp",
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
