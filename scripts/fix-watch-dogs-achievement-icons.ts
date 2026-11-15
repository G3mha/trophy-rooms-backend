/**
 * Set icons on Watch Dogs' three official sets: the PSN Achievement Set, the
 * Online trophies and Bad Blood.
 *
 * These are the game's own PS4 trophy icons (NPWR05212_00), taken from
 * Sony's trophy image server, flattened onto black where the corners are
 * transparent and scaled from 240 to 256px. They're hosted on the Cloudflare
 * R2 bucket behind assets.trophyrooms.org. File names carry a content hash,
 * so a replaced icon gets a new URL instead of a stale cache.
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

const FAMILY_TITLE = "Watch Dogs";
const ICON_BASE = "https://assets.trophyrooms.org/achievements/watch-dogs/";

const ICONS: Record<string, string> = {
  "100% Clear": "100-clear-bcc39bdf.webp",
  "Hello World": "hello-world-cf14d4b4.webp",
  "End of Line": "end-of-line-8dff26f6.webp",
  "Basest Base": "basest-base-e3e3c52b.webp",
  "They Call Him The Vigilante": "they-call-him-the-vigilante-a4e1cc00.webp",
  "Peephole": "peephole-b795c808.webp",
  "Road Rage": "road-rage-c09f04e4.webp",
  "Enforcer": "enforcer-4f729a64.webp",
  "Family Man": "family-man-e0607f5b.webp",
  "Who Is Raymond Kenney?": "who-is-raymond-kenney-29bf35bf.webp",
  "One Down, One to Go": "one-down-one-to-go-de83a6df.webp",
  "Vengeance": "vengeance-068fc9c1.webp",
  "Log Off": "log-off-99039c10.webp",
  "Hard Crash": "hard-crash-32eec60f.webp",
  "Communication Fail": "communication-fail-9970a4bf.webp",
  "Bookmarked": "bookmarked-18a94746.webp",
  "Power Cycle": "power-cycle-23acadfb.webp",
  "Magic Smoke": "magic-smoke-7edd081a.webp",
  "Escape Loop": "escape-loop-288cc464.webp",
  "Free Radical": "free-radical-efb64ecf.webp",
  "White Rabbit Object": "white-rabbit-object-2542688c.webp",
  "Scanproof": "scanproof-f7366111.webp",
  "Hardware Fail": "hardware-fail-31b712c9.webp",
  "Black Hat Trick": "black-hat-trick-3be7ff9f.webp",
  "Revoking Client Privileges": "revoking-client-privileges-98f2a21f.webp",
  "Saturday Night Special": "saturday-night-special-ecddbcd5.webp",
  "Sanity Check": "sanity-check-f7fcbbbd.webp",
  "Read-only": "read-only-7dab2837.webp",
  "Darkness Looms": "darkness-looms-90469c6d.webp",
  "Geolocated": "geolocated-738dae51.webp",
  "Disk Space Full": "disk-space-full-eb784030.webp",
  "Social Lubricant": "social-lubricant-539ad0f6.webp",
  "Hackification": "hackification-9fb4d745.webp",
  "Piggyback": "piggyback-3ca19fd6.webp",
  "Superhighway": "superhighway-9802d1a4.webp",
  "System Mangler": "system-mangler-f71055fc.webp",
  "Stealth Cookie": "stealth-cookie-d0bac5b4.webp",
  "Freeware": "freeware-5f803578.webp",
  "Traced": "traced-62ded1bb.webp",
  "Clear Signals": "clear-signals-7f021cd6.webp",
  "T-Bone: Friends in Need": "t-bone-friends-in-need-6c5a831d.webp",
  "T-Bone: No Easy Fix": "t-bone-no-easy-fix-653e221a.webp",
  "T-Bone: Pest Control": "t-bone-pest-control-d95a761b.webp",
  "T-Bone: Mob Ruled": "t-bone-mob-ruled-1f618b26.webp",
  "T-Bone: Second Amendement": "t-bone-second-amendement-d52039f7.webp",
  "T-Bone: Unfixable": "t-bone-unfixable-1258db30.webp",
  "T-Bone: Full Circuit": "t-bone-full-circuit-77001286.webp",
  "T-Bone: Tag Team": "t-bone-tag-team-8b0ef1b0.webp",
  "T-Bone: Looking For Trouble": "t-bone-looking-for-trouble-4aad1d0b.webp",
  "T-Bone: Negative Eugenics": "t-bone-negative-eugenics-ad97336a.webp",
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
