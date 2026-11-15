/**
 * Set icons on Watch Dogs 2's three official sets: the PSN Trophy List, the
 * Online trophies and the Story DLC.
 *
 * These are the game's own PS4 trophy icons (NPWR10664_00), taken from
 * Sony's trophy image server. All but the Platinum draw a dotted ring near
 * the edge, which doubled up with the card's tier ring, so those 55 are
 * cropped to the 196px square inside it. Everything is scaled to 256px and
 * hosted on the Cloudflare R2 bucket behind assets.trophyrooms.org. File
 * names carry a content hash, so a replaced icon gets a new URL instead of a
 * stale cache.
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

const FAMILY_TITLE = "Watch Dogs 2";
const ICON_BASE = "https://assets.trophyrooms.org/achievements/watch-dogs-2/";

const ICONS: Record<string, string> = {
  "Graduation Day": "graduation-day-19845696.webp",
  "Who Am I": "who-am-i-dc4c1a27.webp",
  "Put Your Damn Pants On": "put-your-damn-pants-on-2c06250b.webp",
  "Menace": "menace-c2d65bfd.webp",
  "In Style": "in-style-bb6e1632.webp",
  "DedSec-A-Roni": "dedsec-a-roni-4bf4a3be.webp",
  "Only God Can Judge Me": "only-god-can-judge-me-c7d52038.webp",
  "Doggyland": "doggyland-e25ae085.webp",
  "Photobombed!": "photobombed-f47fc69e.webp",
  "A Ride to Remember": "a-ride-to-remember-5c7bfb43.webp",
  "Bad Boys": "bad-boys-6a07816a.webp",
  "Something To Ride": "something-to-ride-a0c23ea4.webp",
  "Researcher": "researcher-83336b3f.webp",
  "Smooth Felon": "smooth-felon-5ba6d954.webp",
  "Miniroadtrip!": "miniroadtrip-4547c320.webp",
  "Knock You Out": "knock-you-out-d018db09.webp",
  "Jump Around": "jump-around-ab7fbc5e.webp",
  "Earn your Sea Legs": "earn-your-sea-legs-140c0d6e.webp",
  "Roboteer": "roboteer-1f87ff6f.webp",
  "Third Time's the Charm": "third-times-the-charm-60c71354.webp",
  "Hold My Hair": "hold-my-hair-d969019e.webp",
  "Let Me Ride": "let-me-ride-0be411b8.webp",
  "One of the Gang": "one-of-the-gang-360728e1.webp",
  "Natural Born Killer": "natural-born-killer-20ec7c29.webp",
  "Please Marcus, Don't Hurt Them": "please-marcus-dont-hurt-them-b84b561e.webp",
  "Hold My Hand": "hold-my-hand-60d71295.webp",
  "Feeding Frenzy": "feeding-frenzy-5a06cab8.webp",
  "Troll'r": "trollr-9fd9afdc.webp",
  "Got The Shutterbug": "got-the-shutterbug-004058fb.webp",
  "One-Man Garage": "one-man-garage-8d158d4c.webp",
  "Pimp My eKart": "pimp-my-ekart-3ff3a315.webp",
  "App'ing Around": "apping-around-dae9a9d9.webp",
  "I Get Around": "i-get-around-2b3fc23a.webp",
  "Ain't No Stopping": "aint-no-stopping-0b4f831b.webp",
  "The Fox": "the-fox-3673d0f7.webp",
  "Joined the Mile High Club": "joined-the-mile-high-club-28a86186.webp",
  "Picking Up the Pieces": "picking-up-the-pieces-5b1b5672.webp",
  "Baby, I Got Your Money": "baby-i-got-your-money-5c180f86.webp",
  "Knight Ridden": "knight-ridden-eb5e9dfc.webp",
  "No Place Like Haum": "no-place-like-haum-37908a23.webp",
  "Informer": "informer-f5392bc0.webp",
  "100% Legit": "100-legit-5c799925.webp",
  "Hypnotize": "hypnotize-fe07f0b2.webp",
  "Old School Justice": "old-school-justice-ae9cb0ff.webp",
  "Sabotage": "sabotage-27d099c4.webp",
  "Make Every Voice Count": "make-every-voice-count-cc329f95.webp",
  "The Itsy Bitsy Spider": "the-itsy-bitsy-spider-03761bad.webp",
  "You're On A Boat!": "youre-on-a-boat-597be4a5.webp",
  "Leaks and Leaks": "leaks-and-leaks-45df0eaf.webp",
  "Hack the World": "hack-the-world-272b8b97.webp",
  "Not the Pizza Guy": "not-the-pizza-guy-663976f8.webp",
  "The Score of Your Life": "the-score-of-your-life-f7af30cd.webp",
  "Nanotriumph": "nanotriumph-49651cbd.webp",
  "Prize Catch": "prize-catch-c4818643.webp",
  "That Escalated Quickly": "that-escalated-quickly-28840d2c.webp",
  "It's the Final Showd0wn": "its-the-final-showd0wn-b47a0227.webp",
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
