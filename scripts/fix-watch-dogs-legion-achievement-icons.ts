/**
 * Set icons on Watch Dogs: Legion's three official sets: the PSN Trophy List,
 * Bloodline and Resistance Mode.
 *
 * These are the game's own trophy icons, taken from Sony's trophy image
 * server. The PS4 and PS5 lists share the same art, so these are the PS5
 * list's 512px versions (NPWR21033_00) rather than PS4's 240px ones. Each
 * icon is a medallion with a beveled rim that doubled up with the card's tier
 * ring, so all 50 are cropped to the 432px square inside it. Everything is
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

const FAMILY_TITLE = "Watch Dogs: Legion";
const ICON_BASE = "https://assets.trophyrooms.org/achievements/watch-dogs-legion/";

const ICONS: Record<string, string> = {
  "Completionist": "completionist-8ec79e75.webp",
  "Brave New World": "brave-new-world-0a09601c.webp",
  "The Future Is Bright": "the-future-is-bright-3757a48f.webp",
  "Long Live The Queen": "long-live-the-queen-1193a591.webp",
  "Hacker, Tailor, Soldier, Spy": "hacker-tailor-soldier-spy-d02264fc.webp",
  "When Good Men Do Nothing": "when-good-men-do-nothing-fc84f4fb.webp",
  "Divided We Fall": "divided-we-fall-60ef9895.webp",
  "The One That Got Away": "the-one-that-got-away-c1599c6a.webp",
  "In The Nick of Time": "in-the-nick-of-time-a20ae42d.webp",
  "A Roof Over Your Head": "a-roof-over-your-head-463cecb4.webp",
  "England For Everyone": "england-for-everyone-22fd07e1.webp",
  "A Dish Best Served Cold": "a-dish-best-served-cold-f9fddfd0.webp",
  "Making Friends": "making-friends-0bfd54e7.webp",
  "Rise Up": "rise-up-2ae3f63c.webp",
  "Take Back London": "take-back-london-4ca98d43.webp",
  "And Stay Down": "and-stay-down-79e2dcd0.webp",
  "Every Walk of Life": "every-walk-of-life-cd593196.webp",
  "Meta-Gaming": "meta-gaming-170f7a67.webp",
  "Down To The Wire": "down-to-the-wire-24ac8d82.webp",
  "Death From Above": "death-from-above-d5166a17.webp",
  "NO NOT THE BEES": "no-not-the-bees-6200adcb.webp",
  "Hack The Planet": "hack-the-planet-92525a01.webp",
  "Shaken Not Stirred": "shaken-not-stirred-3d2685b8.webp",
  "Power To The People": "power-to-the-people-896b6401.webp",
  "Paint Me Like One of Your...": "paint-me-like-one-of-your-ebd7abc6.webp",
  "Throw The Book At Them": "throw-the-book-at-them-c7081af3.webp",
  "The Royal Tour": "the-royal-tour-08809f19.webp",
  "You Don't See Me!": "you-dont-see-me-ea7b26e2.webp",
  "Could've Made National": "couldve-made-national-9879d05f.webp",
  "Bullseye": "bullseye-5c3963df.webp",
  "Piece de Resistance": "piece-de-resistance-f7cbac5f.webp",
  "Bottom's Up": "bottoms-up-c28eee07.webp",
  "DedSec Delivery": "dedsec-delivery-5c7148b2.webp",
  "All About Aesthetic": "all-about-aesthetic-f4f6fa14.webp",
  "Re-Wrap My Whip": "re-wrap-my-whip-600d9494.webp",
  "Fresh Threads": "fresh-threads-a9e94727.webp",
  "Fully Kitted": "fully-kitted-7ef73cbe.webp",
  "Locked And Loaded": "locked-and-loaded-c67eab55.webp",
  "Oral History": "oral-history-99a4117e.webp",
  "Magpie": "magpie-7faae63a.webp",
  "Breaking The Ice": "breaking-the-ice-98ddc7a1.webp",
  "Switcheroo": "switcheroo-b427ae73.webp",
  "One Big Happy Family": "one-big-happy-family-ca26e557.webp",
  "Fully Kitted 2.0": "fully-kitted-2-0-7365a882.webp",
  "Packrat": "packrat-719a0420.webp",
  "Vive la Résistance": "vive-la-resistance-d0bd0d16.webp",
  "Community Service": "community-service-817c874f.webp",
  "Off The Record": "off-the-record-af6bb6d4.webp",
  "Supply And Demand": "supply-and-demand-57efa4bc.webp",
  "Long Live DedSec": "long-live-dedsec-aef540b4.webp",
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
