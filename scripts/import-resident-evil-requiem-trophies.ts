/**
 * Import the official Resident Evil Requiem trophy list.
 *
 * This is the real PSN list, not a hand-authored completionist set: 50
 * trophies, 1 Platinum / 3 Gold / 6 Silver / 40 Bronze. Steam and Xbox ship
 * the same 49 without the Platinum, so the PSN list is the superset and is
 * what goes in. Cross-checked three ways before import: Steam's
 * GetGlobalAchievementPercentagesForApp reports 49 achievements for app
 * 3764200, trophy guides report the 1/3/6/40 split, and the list below sums
 * to exactly that.
 *
 * Not to be confused with the in-game Challenges, which are a separate
 * system paying out CP for the Bonuses shop. They overlap with the trophies
 * but are neither the same list nor the same count.
 *
 * No icons: Steam's achievement XML endpoint now 302-redirects to a
 * JS-rendered page, so src/../populate-achievement-icons.ts cannot reach it.
 * Official art needs a Steam Web API key (GetSchemaForGame).
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
const SET_TITLE = "PSN Achievement Set";

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

const { BRONZE, SILVER, GOLD, PLATINUM } = AchievementTier;

// PSN list order: Platinum first, then the nine story trophies, then the rest.
const ACHIEVEMENTS: AchievementSeed[] = [
  { title: "Requiem", description: "Obtain all trophies.", tier: PLATINUM },

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

  // Challenge-tracked and gallery
  { title: "Speed Demon", description: "Complete the main story by releasing Elpis within four hours.", tier: SILVER },
  { title: "Credit Where Credit Is Due", description: "Earn 200,000 credits.", tier: SILVER },
  { title: "Bloodlust", description: "Collect 5000 microsamples of infected blood with the blood collector.", tier: SILVER },
  { title: "Model Mania", description: "View all models.", tier: SILVER },
  { title: "Curator", description: "View all concept art.", tier: SILVER },
  { title: "Never Touch the Stuff", description: "Complete the main story without using herbs or med injectors.", tier: GOLD },
  { title: "Minimalist", description: "Complete the main story without Grace using the blood collector.", tier: GOLD },
];

// The PSN list is fixed, so a drift in these counts means a transcription slip.
const EXPECTED_BY_TIER: Record<AchievementTier, number> = {
  [AchievementTier.BRONZE]: 40,
  [AchievementTier.SILVER]: 6,
  [AchievementTier.GOLD]: 3,
  [AchievementTier.PLATINUM]: 1,
};

function assertShape() {
  const duplicates = ACHIEVEMENTS.map((entry) => entry.title).filter(
    (title, index, titles) => titles.indexOf(title) !== index
  );

  if (duplicates.length > 0) {
    throw new Error(`Duplicate trophy titles: ${duplicates.join(", ")}`);
  }

  for (const tier of Object.keys(EXPECTED_BY_TIER) as AchievementTier[]) {
    const actual = ACHIEVEMENTS.filter((entry) => entry.tier === tier).length;
    const expected = EXPECTED_BY_TIER[tier];

    if (actual !== expected) {
      throw new Error(`Expected ${expected} ${tier} trophies, found ${actual}`);
    }
  }
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

  const totalPoints = ACHIEVEMENTS.reduce(
    (sum, achievement) => sum + POINTS_BY_TIER[achievement.tier],
    0
  );

  console.log(
    `${ACHIEVEMENTS.length} trophies (${created} created, ${updated} updated), ${totalPoints} points total`
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
