/**
 * Import the official Watch Dogs: Legion trophy list, split three ways.
 *
 * PS4 (NPWR16685_00) and PS5 (NPWR21033_00) ship identical lists of 50
 * trophies: the base game's 40 (1 Platinum / 2 Gold / 19 Silver / 18 Bronze)
 * and two groups outside the Platinum, Bloodline (7 Bronze / 2 Silver,
 * including the four Resistance Mission questlines) and Resistance Mode (1
 * Silver, clearing every campaign mission on the hardest difficulty). Steam
 * ships the same 49 without the Platinum (GetGlobalAchievementPercentagesForApp
 * reports 49 for app 2239550), so the PSN list is the superset. Titles are
 * PSN's own.
 *
 * Nothing on the list needs online play: Locked And Loaded accepts either the
 * campaign or the online weapon upgrades. Bloodline and Resistance Mode get
 * their own lists that don't gate the trophy, matching PSN.
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

const FAMILY_TITLE = "Watch Dogs: Legion";

type AchievementSeed = {
  title: string;
  description: string;
  tier: AchievementTier;
};

type SetSeed = {
  title: string;
  countsTowardTrophy: boolean;
  achievements: AchievementSeed[];
};

const { BRONZE, SILVER, GOLD, PLATINUM } = AchievementTier;

// PSN list order.
const BASE_SET: SetSeed = {
  title: "PSN Trophy List",
  countsTowardTrophy: true,
  achievements: [
    { title: "Completionist", description: "Get all other Trophies.", tier: PLATINUM },
    { title: "Brave New World", description: "Complete \"Operation Westminster\".", tier: BRONZE },
    { title: "The Future Is Bright", description: "Complete the 404 Storyline.", tier: BRONZE },
    { title: "Long Live The Queen", description: "Complete the Kelley Storyline.", tier: BRONZE },
    { title: "Hacker, Tailor, Soldier, Spy", description: "Complete the SIRS Storyline.", tier: BRONZE },
    { title: "When Good Men Do Nothing", description: "Complete the Albion Storyline.", tier: BRONZE },
    { title: "Divided We Fall", description: "Complete the DedSec Storyline.", tier: GOLD },
    { title: "The One That Got Away", description: "Complete \"Finding Bagley\".", tier: BRONZE },
    { title: "In The Nick of Time", description: "Complete \"Change of Heart\".", tier: BRONZE },
    { title: "A Roof Over Your Head", description: "Complete \"Royal Treatment\".", tier: BRONZE },
    { title: "England For Everyone", description: "Complete \"Parks and Reclamation\".", tier: BRONZE },
    { title: "A Dish Best Served Cold", description: "Complete a Revenge Mission.", tier: BRONZE },
    {
      title: "Making Friends",
      description: "Recruit an Operative in Campaign Mode after completing 'Reporting For Duty'.",
      tier: BRONZE,
    },
    { title: "Rise Up", description: "Turn one borough into Defiant state.", tier: SILVER },
    { title: "Take Back London", description: "Turn all the boroughs into Defiant state.", tier: GOLD },
    { title: "And Stay Down", description: "Defeat a DedSec Adversary.", tier: BRONZE },
    {
      title: "Every Walk of Life",
      description: "Have a team of 20 Operatives with different occupations.",
      tier: SILVER,
    },
    { title: "Meta-Gaming", description: "Recruit a Video Game Designer.", tier: BRONZE },
    { title: "Down To The Wire", description: "Perform 5 stealth takedowns with a Professional Hitman.", tier: SILVER },
    { title: "Death From Above", description: "Kill 5 Albion guards using Dive Bomb.", tier: SILVER },
    { title: "NO NOT THE BEES", description: "Neutralize 10 Albion guards using Bee Swarms.", tier: SILVER },
    { title: "Hack The Planet", description: "Propagate a hack across 8 targets at once.", tier: SILVER },
    {
      title: "Shaken Not Stirred",
      description: "Disable weapons of 5 Albion guards at once using the Spy Watch Gadget.",
      tier: SILVER,
    },
    {
      title: "Power To The People",
      description: "Have your followers neutralize a total of 3 Albion guards.",
      tier: SILVER,
    },
    {
      title: "Paint Me Like One of Your...",
      description: "Stun Clan Kelley members 5 times with paintball gun headshots.",
      tier: SILVER,
    },
    { title: "Throw The Book At Them", description: "Perform 5 arrest takedowns.", tier: SILVER },
    {
      title: "The Royal Tour",
      description: "Enter Buckingham Palace's restricted area disguised as a Royal Guard.",
      tier: SILVER,
    },
    { title: "You Don't See Me!", description: "Escape a Pursuit Level 5 doing a Statue Emote.", tier: SILVER },
    { title: "Could've Made National", description: "Complete Kick up challenge intermediate 1.", tier: BRONZE },
    { title: "Bullseye", description: "Complete a Darts game in every Darts location.", tier: BRONZE },
    { title: "Piece de Resistance", description: "Complete a Paste Up in every Paste Up location.", tier: BRONZE },
    { title: "Bottom's Up", description: "Drink at least once in every Drink location.", tier: BRONZE },
    { title: "DedSec Delivery", description: "Complete 20 Parcel Fox Delivery Missions.", tier: BRONZE },
    { title: "All About Aesthetic", description: "Buy a Weapon Skin.", tier: SILVER },
    { title: "Re-Wrap My Whip", description: "Buy a Vehicle Paint.", tier: SILVER },
    { title: "Fresh Threads", description: "Spend 100 000 ETO on Clothes in Campaign Mode.", tier: SILVER },
    { title: "Fully Kitted", description: "Unlock all Upgrades in Campaign Mode.", tier: SILVER },
    {
      title: "Locked And Loaded",
      description: "Purchase all Campaign Weapon Upgrades or all Online Weapon Upgrades.",
      tier: SILVER,
    },
    { title: "Oral History", description: "Collect 50 Audio Logs.", tier: SILVER },
    { title: "Magpie", description: "Collect 15 Relics.", tier: SILVER },
  ],
};

// The story DLC, then its four Resistance Mission questlines.
const BLOODLINE_SET: SetSeed = {
  title: "Bloodline",
  countsTowardTrophy: false,
  achievements: [
    { title: "Breaking The Ice", description: "Complete \"Acquisition Target\".", tier: BRONZE },
    { title: "Switcheroo", description: "Complete \"Fox Hunt\".", tier: BRONZE },
    { title: "One Big Happy Family", description: "Complete \"Face 2 Face\".", tier: SILVER },
    { title: "Fully Kitted 2.0", description: "Unlock all Upgrades in the Bloodline expansion.", tier: SILVER },
    { title: "Packrat", description: "Collect 50% of Data Drive files in the Bloodline expansion.", tier: BRONZE },
    { title: "Vive la Résistance", description: "Complete all Connie Resistance Missions.", tier: BRONZE },
    { title: "Community Service", description: "Complete all Angel Resistance Missions.", tier: BRONZE },
    { title: "Off The Record", description: "Complete all Claire Resistance Missions.", tier: BRONZE },
    { title: "Supply And Demand", description: "Complete all Freddie Resistance Missions.", tier: BRONZE },
  ],
};

// The free update's hardest difficulty.
const RESISTANCE_MODE_SET: SetSeed = {
  title: "Resistance Mode",
  countsTowardTrophy: false,
  achievements: [
    { title: "Long Live DedSec", description: "Complete all Campaign Missions on Resistance mode.", tier: SILVER },
  ],
};

const SETS = [BASE_SET, BLOODLINE_SET, RESISTANCE_MODE_SET];
const EXPECTED = { "PSN Trophy List": 40, Bloodline: 9, "Resistance Mode": 1 } as Record<string, number>;
// The whole list: 1 Platinum, 2 Gold, 22 Silver, 25 Bronze.
const EXPECTED_TIERS: Record<AchievementTier, number> = { PLATINUM: 1, GOLD: 2, SILVER: 22, BRONZE: 25 };

function assertShape() {
  const all = SETS.flatMap((set) => set.achievements);
  const titles = all.map((achievement) => achievement.title);
  const duplicates = titles.filter((title, index) => titles.indexOf(title) !== index);
  if (duplicates.length > 0) throw new Error(`Duplicate titles: ${duplicates.join(", ")}`);

  for (const set of SETS) {
    if (set.achievements.length !== EXPECTED[set.title]) {
      throw new Error(`Expected ${EXPECTED[set.title]} trophies in ${set.title}, found ${set.achievements.length}`);
    }
  }

  for (const tier of Object.values(AchievementTier)) {
    const count = all.filter((achievement) => achievement.tier === tier).length;
    if (count !== EXPECTED_TIERS[tier]) throw new Error(`Expected ${EXPECTED_TIERS[tier]} ${tier}, found ${count}`);
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  assertShape();

  const families = await prisma.gameFamily.findMany({
    where: { title: FAMILY_TITLE },
    select: { id: true, title: true },
  });
  if (families.length !== 1) {
    throw new Error(`Expected one family titled ${FAMILY_TITLE}, found ${families.length}`);
  }
  const family = families[0];

  for (const seed of SETS) {
    const existingSet = await prisma.achievementSet.findFirst({
      where: { gameFamilyId: family.id, title: seed.title, type: AchievementSetType.OFFICIAL },
      select: { id: true },
    });

    if (!apply) {
      console.log(
        `Would ${existingSet ? "update" : "create"} "${seed.title}" for ${family.title} (${family.id}): ` +
          `${seed.achievements.length} trophies, ${seed.countsTowardTrophy ? "gates" : "doesn't gate"} the trophy`,
      );
      continue;
    }

    const set =
      existingSet ??
      (await prisma.achievementSet.create({
        data: {
          title: seed.title,
          type: AchievementSetType.OFFICIAL,
          visibility: AchievementSetVisibility.PUBLIC,
          countsTowardTrophy: seed.countsTowardTrophy,
          gameFamilyId: family.id,
        },
        select: { id: true },
      }));
    if (existingSet) {
      await prisma.achievementSet.update({
        where: { id: set.id },
        data: { countsTowardTrophy: seed.countsTowardTrophy },
      });
    }
    console.log(`${existingSet ? "Reusing" : "Created"} "${seed.title}" (${set.id}) for ${family.title}`);

    let created = 0;
    for (const achievement of seed.achievements) {
      const data = { description: achievement.description, tier: achievement.tier };
      const result = await prisma.achievement.upsert({
        where: { achievementSetId_title: { achievementSetId: set.id, title: achievement.title } },
        update: data,
        create: { ...data, title: achievement.title, achievementSetId: set.id },
        select: { createdAt: true, updatedAt: true },
      });
      if (result.createdAt.getTime() === result.updatedAt.getTime()) created += 1;
    }
    console.log(`${seed.achievements.length} trophies (${created} created, ${seed.achievements.length - created} updated)`);
  }

  if (!apply) console.log("Dry run. Pass --apply to write.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
