/**
 * Import the in-game Challenges list for Resident Evil Requiem.
 *
 * The Challenges tab is a real Capcom-authored list, so this goes in as
 * OFFICIAL rather than a hand-authored completionist set. Fifty challenges,
 * cross-checked against two independent transcriptions (Game8 and
 * ClutchPoints) that agree on the count, the entries and their order. A third
 * (FinalBoss) lists only 42 but adds nothing outside the other two, so it
 * corroborates as a subset.
 *
 * Worth knowing before touching this file: the Challenges list is very nearly
 * the trophy list. Forty-nine of the fifty are the PSN trophies by exact
 * title, every non-Platinum trophy is a challenge, and the one challenge that
 * is not a trophy is The Final Puzzle. assertAgainstTrophies() checks that
 * relationship against the database on every run, so if a future edit or a
 * patch breaks it the import fails instead of quietly drifting.
 *
 * Tiers mirror the PSN set for the forty-nine shared entries, so the same
 * accomplishment does not carry two different weights in the same game. The
 * Final Puzzle is SILVER: its 20,000 CP reward matches Speed Demon's, which
 * is a Silver trophy.
 *
 * CP reward values are deliberately not transcribed. Game8 shows them for
 * only 19 of the 50 (the in-game menu hides a challenge's CP once it is
 * complete), ClutchPoints fills in the rest but is the sole source for most
 * of those, and the two disagree where both report. The schema has no reward
 * field anyway, so there is nowhere honest to put them.
 */

import {
  AchievementSetType,
  AchievementSetVisibility,
  AchievementTier,
  PrismaClient,
} from "@prisma/client";

try {
  process.loadEnvFile?.();
} catch {
  // Ignore missing env file in deployed environments.
}

const prisma = new PrismaClient();

const FAMILY_TITLE = "Resident Evil Requiem";
const SET_TITLE = "In-Game Challenges";
const TROPHY_SET_TITLE = "PSN Achievement Set";

const POINTS_BY_TIER: Record<AchievementTier, number> = {
  [AchievementTier.BRONZE]: 15,
  [AchievementTier.SILVER]: 30,
  [AchievementTier.GOLD]: 90,
  [AchievementTier.PLATINUM]: 300,
};

type AchievementSeed = {
  title: string;
  description: string;
  tier: AchievementTier;
};

const { BRONZE, SILVER, GOLD } = AchievementTier;

// In the order the Challenges menu lists them. No Platinum: the in-game list
// has no capstone, and inventing one would misreport a publisher list. Every
// RetroAchievements set in this database is Platinum-less for the same reason.
const ACHIEVEMENTS: AchievementSeed[] = [
  // Story
  { title: "Déjà vu", description: "Encounter an outbreak in Wrenwood.", tier: BRONZE },
  { title: "Descent Into Darkness", description: "Reach the basement of the care center.", tier: BRONZE },
  { title: "It's Been a Long Night", description: "Reach the courtyard of the care center.", tier: BRONZE },
  { title: "A Harsh Reality", description: "Escape the care center.", tier: BRONZE },
  { title: "Going Down?", description: "Reach the ground using the suspended platform.", tier: BRONZE },
  { title: "The Hero Returns", description: "Arrive at R.P.D.", tier: BRONZE },
  { title: "I Remember That, Too", description: "Defeat the Super Tyrant.", tier: BRONZE },
  { title: "Umbrella's Legacy", description: "Find ARK.", tier: BRONZE },
  { title: "The Final Mission", description: "Start exploring the lower levels of ARK.", tier: BRONZE },

  // Completion and difficulty
  { title: "Hope and Requiem", description: "Complete the main story by releasing Elpis.", tier: BRONZE },
  { title: "Rookie Agent", description: "Complete the main story on at least Casual difficulty.", tier: BRONZE },
  { title: "Rising Agent", description: "Complete the main story on at least Standard (Modern) difficulty.", tier: BRONZE },
  { title: "Resolute Agent", description: "Complete the main story on at least Standard (Classic) difficulty.", tier: SILVER },
  { title: "Remarkable Agent", description: "Complete the main story on Insanity difficulty.", tier: GOLD },

  // Systems and mechanics
  { title: "Out of Sight, Out of Mind", description: "Store an item in the item box as Grace.", tier: BRONZE },
  { title: "The Ol' Fashioned Way", description: "Use an ink ribbon to save at a typewriter.", tier: BRONZE },
  { title: "Like Mother, Like Daughter", description: "Unlock a drawer with a lockpick.", tier: BRONZE },
  { title: "Fatal Dose", description: "Defeat a zombie using the hemolytic injector.", tier: BRONZE },
  { title: "Science!", description: "Unlock a crafting recipe using analysis.", tier: BRONZE },
  { title: "The Power of Blood", description: "Craft an item using the blood collector.", tier: BRONZE },
  { title: "Blood! More Blood!", description: "Use 300 microsamples of infected blood.", tier: BRONZE },
  { title: "Bring Out the Big Guns", description: "Stun the Girl with Requiem.", tier: BRONZE },
  { title: "The Hunt Begins", description: "Destroy one Mr. Raccoon memoriam.", tier: BRONZE },
  { title: "Untouchable", description: "Parry an enemy attack.", tier: BRONZE },
  { title: "Can I Borrow This?", description: "Throw a weapon dropped by an enemy.", tier: BRONZE },
  { title: "Chop Chop", description: "Defeat three zombies with a hatchet finishing attack.", tier: BRONZE },
  { title: "Retail Therapy", description: "Purchase an item from the supply box.", tier: BRONZE },
  { title: "Tailor Made", description: "Upgrade a weapon.", tier: BRONZE },
  { title: "Road Rage", description: "Stop one of Victor's attacks on the highway.", tier: BRONZE },
  { title: "Master Craftsman", description: "Craft every possible item with Leon.", tier: BRONZE },

  // Combat feats
  { title: "Bang For Your Buck", description: "Defeat at least three enemies with a single Requiem shot.", tier: BRONZE },
  { title: "Cat Got Your Tongue?", description: "Cut the tongue off a Licker β2 using the hatchet.", tier: BRONZE },
  { title: "Order Up!", description: "Defeat the chef in the care center in the main story.", tier: BRONZE },
  { title: "Deadly Duet", description: "Defeat the two singers in the main story.", tier: BRONZE },
  { title: "Grace and Goliath", description: "Defeat a Chunk as Grace.", tier: BRONZE },
  { title: "Internal Dispute", description: "Make a zombie attack another zombie in the hospital wards.", tier: BRONZE },
  { title: "Seasoned Pro", description: "Defeat 300 enemies.", tier: BRONZE },
  { title: "Not Today, Buds!", description: "Defeat all the Plant 43 seedlings.", tier: BRONZE },

  // Collectibles
  { title: "No Safe is Safe", description: "Open every safe in the main story.", tier: BRONZE },
  { title: "Crate Expectations", description: "Open all BSAA containers.", tier: BRONZE },
  { title: "Case Closed", description: "Read all the files in the main story.", tier: BRONZE },
  { title: "You Little Rascal!", description: "Destroy every Mr. Raccoon memoriam.", tier: BRONZE },

  // Runs, grinds and gallery
  { title: "Speed Demon", description: "Complete the main story by releasing Elpis within four hours.", tier: SILVER },
  { title: "Credit Where Credit Is Due", description: "Earn 200,000 credits.", tier: SILVER },
  { title: "Bloodlust", description: "Collect 5000 microsamples of infected blood with the blood collector.", tier: SILVER },
  { title: "Model Mania", description: "View all models.", tier: SILVER },
  { title: "Curator", description: "View all concept art.", tier: SILVER },
  { title: "Never Touch the Stuff", description: "Complete the main story without using herbs or med injectors.", tier: GOLD },
  { title: "Minimalist", description: "Complete the main story without Grace using the blood collector.", tier: GOLD },

  // The one challenge with no trophy behind it.
  { title: "The Final Puzzle", description: "Let the sweet pair hear the voice.", tier: SILVER },
];

// The in-game list is fixed, so drift in these counts means a transcription slip.
const EXPECTED_BY_TIER: Record<AchievementTier, number> = {
  [AchievementTier.BRONZE]: 40,
  [AchievementTier.SILVER]: 7,
  [AchievementTier.GOLD]: 3,
  [AchievementTier.PLATINUM]: 0,
};

// The single challenge that is not also a PSN trophy.
const EXPECTED_NON_TROPHY_TITLES = ["The Final Puzzle"];

function assertShape() {
  const duplicates = ACHIEVEMENTS.map((entry) => entry.title).filter(
    (title, index, titles) => titles.indexOf(title) !== index
  );

  if (duplicates.length > 0) {
    throw new Error(`Duplicate challenge titles: ${duplicates.join(", ")}`);
  }

  for (const tier of Object.keys(EXPECTED_BY_TIER) as AchievementTier[]) {
    const actual = ACHIEVEMENTS.filter((entry) => entry.tier === tier).length;
    const expected = EXPECTED_BY_TIER[tier];

    if (actual !== expected) {
      throw new Error(`Expected ${expected} ${tier} challenges, found ${actual}`);
    }
  }
}

/**
 * Check the challenge list against the imported PSN trophies: exactly one
 * challenge should have no trophy behind it, and every non-Platinum trophy
 * should be a challenge. Skipped when the trophy set is absent.
 */
async function assertAgainstTrophies(gameFamilyId: string) {
  const trophySet = await prisma.achievementSet.findFirst({
    where: { gameFamilyId, title: TROPHY_SET_TITLE },
    select: { achievements: { select: { title: true, tier: true } } },
  });

  if (!trophySet) {
    console.warn(`No "${TROPHY_SET_TITLE}" to cross-check against, skipping.`);
    return;
  }

  const trophyTitles = new Set(trophySet.achievements.map((a) => a.title));
  const nonPlatinum = trophySet.achievements
    .filter((a) => a.tier !== AchievementTier.PLATINUM)
    .map((a) => a.title);

  const notTrophies = ACHIEVEMENTS.map((a) => a.title).filter((t) => !trophyTitles.has(t));
  const missing = nonPlatinum.filter(
    (title) => !ACHIEVEMENTS.some((a) => a.title === title)
  );

  if (missing.length > 0) {
    throw new Error(`Trophies with no matching challenge: ${missing.join(", ")}`);
  }

  const unexpected = notTrophies.filter((t) => !EXPECTED_NON_TROPHY_TITLES.includes(t));
  if (unexpected.length > 0) {
    throw new Error(`Unexpected challenges with no trophy: ${unexpected.join(", ")}`);
  }

  console.log(
    `Cross-check: ${ACHIEVEMENTS.length - notTrophies.length}/${ACHIEVEMENTS.length} ` +
      `challenges share a trophy title; only ${notTrophies.join(", ")} stands alone.`
  );
}

/**
 * Give the matching challenges their trophy's icon.
 *
 * The Challenges menu is a plain text list in game, so these rows have no art
 * of their own. For the forty-nine that share a trophy title the trophy's icon
 * is the same accomplishment's art, and the alternative is fifty blank tiles
 * beside a fully illustrated set. Only fills empty icons, never replaces one.
 */
async function reuseTrophyIcons(setId: string, gameFamilyId: string) {
  const [challenges, trophies] = await Promise.all([
    prisma.achievement.findMany({
      where: { achievementSetId: setId, iconUrl: null },
      select: { id: true, title: true },
    }),
    prisma.achievement.findMany({
      where: {
        achievementSet: { gameFamilyId, title: TROPHY_SET_TITLE },
        iconUrl: { not: null },
      },
      select: { title: true, iconUrl: true },
    }),
  ]);

  const iconByTitle = new Map(trophies.map((t) => [t.title, t.iconUrl!]));
  let filled = 0;

  for (const challenge of challenges) {
    const iconUrl = iconByTitle.get(challenge.title);
    if (!iconUrl) continue;

    await prisma.achievement.update({
      where: { id: challenge.id },
      data: { iconUrl },
    });
    filled += 1;
  }

  const stillBlank = challenges.length - filled;
  console.log(
    `Icons: reused ${filled} from "${TROPHY_SET_TITLE}"` +
      (stillBlank > 0 ? `, ${stillBlank} still blank (no matching trophy icon)` : "")
  );
}

async function findFamily() {
  const families = await prisma.gameFamily.findMany({
    where: { title: FAMILY_TITLE },
    select: { id: true, title: true },
  });

  if (families.length === 0) {
    throw new Error(`Game family not found: ${FAMILY_TITLE}`);
  }

  if (families.length > 1) {
    throw new Error(
      `Multiple game families titled ${FAMILY_TITLE}: ${families.map((family) => family.id).join(", ")}`
    );
  }

  return families[0];
}

async function main() {
  assertShape();

  const family = await findFamily();
  await assertAgainstTrophies(family.id);

  const existingSet = await prisma.achievementSet.findFirst({
    where: {
      gameFamilyId: family.id,
      title: SET_TITLE,
      type: AchievementSetType.OFFICIAL,
    },
  });

  const set =
    existingSet ??
    (await prisma.achievementSet.create({
      data: {
        title: SET_TITLE,
        type: AchievementSetType.OFFICIAL,
        visibility: AchievementSetVisibility.PUBLIC,
        gameFamilyId: family.id,
      },
    }));

  console.log(
    `${existingSet ? "Reusing" : "Created"} "${SET_TITLE}" (${set.id}) for ${family.title}`
  );

  let created = 0;
  let updated = 0;

  for (const achievement of ACHIEVEMENTS) {
    const data = {
      description: achievement.description,
      tier: achievement.tier,
      points: POINTS_BY_TIER[achievement.tier],
    };

    const result = await prisma.achievement.upsert({
      where: {
        achievementSetId_title: {
          achievementSetId: set.id,
          title: achievement.title,
        },
      },
      update: data,
      create: {
        ...data,
        title: achievement.title,
        achievementSetId: set.id,
      },
      select: { createdAt: true, updatedAt: true },
    });

    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      created += 1;
    } else {
      updated += 1;
    }
  }

  await reuseTrophyIcons(set.id, family.id);

  const totalPoints = ACHIEVEMENTS.reduce(
    (sum, achievement) => sum + POINTS_BY_TIER[achievement.tier],
    0
  );

  console.log(
    `${ACHIEVEMENTS.length} challenges (${created} created, ${updated} updated), ${totalPoints} points total`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
