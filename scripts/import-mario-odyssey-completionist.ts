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

const FAMILY_TITLE = "Super Mario Odyssey";
const SET_TITLE = "Completionist set";

// Same scale as the hand-authored New Super Mario Bros. set.
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

// Completion here means the game's own maxed-out state: the 880 Power Moons
// that exist in the kingdoms, the counter pushed to its 999 ceiling with
// Crazy Cap purchases, all 1,000 regional coins, all 52 captures and every
// outfit, souvenir and sticker. Luigi's Balloon World is deliberately absent -
// it needs other players' courses, and an online mode should never gate a
// single-player completion.
const ACHIEVEMENTS: AchievementSeed[] = [
  // Story
  { title: "Hat's Off", description: "Team up with Cappy and leave the Cap Kingdom.", tier: BRONZE },
  { title: "Odyssey Underway", description: "Restore the Odyssey in the Cascade Kingdom.", tier: BRONZE },
  { title: "Wedding Crashed", description: "Defeat Bowser on the Moon and finish the main story.", tier: GOLD },
  { title: "Royal Invitation", description: "Reach the Mushroom Kingdom.", tier: BRONZE },
  { title: "Arrival at Rabbit Ridge", description: "Clear the Dark Side.", tier: SILVER },
  { title: "Long Journey's End", description: "Clear the Darker Side.", tier: GOLD },

  // Power Moon milestones
  { title: "Moonstruck", description: "Collect 100 Power Moons.", tier: BRONZE },
  { title: "Dark Invitation", description: "Collect 250 Power Moons and open the way to the Dark Side.", tier: BRONZE },
  { title: "Half a Sky", description: "Collect 500 Power Moons and open the way to the Darker Side.", tier: SILVER },
  { title: "Lunar Hoard", description: "Collect 750 Power Moons.", tier: SILVER },
  { title: "Every Moon in the Sky", description: "Collect all 880 Power Moons hidden across the kingdoms.", tier: GOLD },
  { title: "Counter Maxed", description: "Reach 999 Power Moons by buying the rest at Crazy Cap.", tier: GOLD },

  // Per-kingdom Power Moon sweeps. The Darker Side holds a single Power Moon,
  // so clearing it (Long Journey's End) already is its sweep.
  { title: "Bonneton Swept", description: "Collect every Power Moon in the Cap Kingdom.", tier: BRONZE },
  { title: "Fossil Falls Swept", description: "Collect every Power Moon in the Cascade Kingdom.", tier: BRONZE },
  { title: "Tostarena Swept", description: "Collect every Power Moon in the Sand Kingdom.", tier: SILVER },
  { title: "Lake Lamode Swept", description: "Collect every Power Moon in the Lake Kingdom.", tier: BRONZE },
  { title: "Steam Gardens Swept", description: "Collect every Power Moon in the Wooded Kingdom.", tier: SILVER },
  { title: "Nimbus Arena Swept", description: "Collect every Power Moon in the Cloud Kingdom.", tier: BRONZE },
  { title: "Forgotten Isle Swept", description: "Collect every Power Moon in the Lost Kingdom.", tier: BRONZE },
  { title: "New Donk City Swept", description: "Collect every Power Moon in the Metro Kingdom.", tier: SILVER },
  { title: "Shiveria Swept", description: "Collect every Power Moon in the Snow Kingdom.", tier: SILVER },
  { title: "Bubblaine Swept", description: "Collect every Power Moon in the Seaside Kingdom.", tier: SILVER },
  { title: "Mount Volbono Swept", description: "Collect every Power Moon in the Luncheon Kingdom.", tier: SILVER },
  { title: "Crumbleden Swept", description: "Collect every Power Moon in the Ruined Kingdom.", tier: BRONZE },
  { title: "Bowser's Castle Swept", description: "Collect every Power Moon in Bowser's Kingdom.", tier: SILVER },
  { title: "Honeylune Ridge Swept", description: "Collect every Power Moon in the Moon Kingdom.", tier: BRONZE },
  { title: "Peach's Castle Swept", description: "Collect every Power Moon in the Mushroom Kingdom.", tier: GOLD },
  { title: "Rabbit Ridge Swept", description: "Collect every Power Moon on the Dark Side.", tier: GOLD },

  // Regional coins. Only thirteen kingdoms have them: the Cloud and Ruined
  // Kingdoms and both Sides have none.
  { title: "Purple Patch", description: "Collect every regional coin in one kingdom.", tier: BRONZE },
  { title: "Purple Pockets", description: "Collect every regional coin in five kingdoms.", tier: BRONZE },
  { title: "Purple Reign", description: "Collect every regional coin in ten kingdoms.", tier: SILVER },
  { title: "All One Thousand", description: "Collect all 1,000 regional coins across the thirteen kingdoms that have them.", tier: GOLD },

  // Capture List
  { title: "Cappy's First Catch", description: "Capture your first enemy with Cappy.", tier: BRONZE },
  { title: "Shape Shifter", description: "Fill half of the Capture List.", tier: BRONZE },
  { title: "Complete Control", description: "Fill the Capture List with all 52 captures.", tier: SILVER },

  // Wardrobe and the Odyssey itself
  { title: "New Threads", description: "Buy your first outfit at Crazy Cap.", tier: BRONZE },
  { title: "Fashion Icon", description: "Own all 58 outfits, including the special ones.", tier: GOLD },
  { title: "Souvenir Shopper", description: "Buy your first souvenir for the Odyssey.", tier: BRONZE },
  { title: "Fully Furnished", description: "Buy every souvenir and sticker for the Odyssey.", tier: SILVER },

  // Side challenges
  { title: "Jump-Rope Genius", description: "Reach 100 jumps in the New Donk City jump-rope challenge.", tier: SILVER },
  { title: "Volleyball Veteran", description: "Keep a 100-hit volleyball rally going in Bubblaine.", tier: SILVER },
  { title: "Koopa Freerunner", description: "Beat the Koopas at every freerunning race.", tier: SILVER },
  { title: "Rock Breaker", description: "Smash the Moon Rock in every kingdom.", tier: SILVER },
  { title: "Peach Hunter", description: "Find Princess Peach in every kingdom after the main story.", tier: SILVER },
  { title: "Riding High", description: "Ride Yoshi in the Mushroom Kingdom.", tier: BRONZE },

  // Capstone
  { title: "Jump Up, Super Star!", description: "Fully complete Super Mario Odyssey with a maxed-out Power Moon counter.", tier: PLATINUM },
];

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
  const duplicateTitles = ACHIEVEMENTS.map((achievement) => achievement.title).filter(
    (title, index, titles) => titles.indexOf(title) !== index
  );

  if (duplicateTitles.length > 0) {
    throw new Error(`Duplicate achievement titles: ${duplicateTitles.join(", ")}`);
  }

  const family = await findFamily();

  const existingSet = await prisma.achievementSet.findFirst({
    where: {
      gameFamilyId: family.id,
      title: SET_TITLE,
      type: AchievementSetType.COMPLETIONIST,
    },
  });

  const set =
    existingSet ??
    (await prisma.achievementSet.create({
      data: {
        title: SET_TITLE,
        type: AchievementSetType.COMPLETIONIST,
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
    `${ACHIEVEMENTS.length} achievements (${created} created, ${updated} updated), ${totalPoints} points total`
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
