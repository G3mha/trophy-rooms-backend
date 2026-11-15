/**
 * Import the official Watch Dogs (2014) trophy list, split three ways.
 *
 * The PS4 list (NPWR05212_00) has 50 trophies: the base game's 40 (1 Platinum
 * / 2 Gold / 19 Silver / 18 Bronze) and the Bad Blood DLC's 10 Bronze in their
 * own group outside the Platinum. Steam ships the same 49 without the
 * Platinum (GetGlobalAchievementPercentagesForApp reports 49 for app 243470),
 * so the PSN list is the superset. Titles are PSN's own, typos included
 * ("Second Amendement").
 *
 * Online is never required for a Trophy Rooms trophy, so the five base
 * trophies that need other players (Online Hacking, Online Tailing, Online
 * Races, and being tailed by invaders) go in their own list that doesn't gate
 * the trophy. Bad Blood doesn't gate it either, matching PSN, which also keeps
 * its one co-op trophy (Tag Team) optional.
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

const FAMILY_TITLE = "Watch Dogs";

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

// PSN list order, less the five online trophies.
const BASE_SET: SetSeed = {
  title: "PSN Achievement Set",
  countsTowardTrophy: true,
  achievements: [
    {
      title: "100% Clear",
      description: "This is the platinum trophy and is unlocked automatically when all the trophies have been unlocked.",
      tier: PLATINUM,
    },
    { title: "Hello World", description: "Take down Maurice.", tier: BRONZE },
    { title: "End of Line", description: "Complete 40 Fixer Contracts.", tier: SILVER },
    { title: "Basest Base", description: "Complete every Gang Hideout.", tier: SILVER },
    { title: "They Call Him The Vigilante", description: "Complete every Investigation.", tier: SILVER },
    { title: "Peephole", description: "Complete every Privacy Invasion.", tier: SILVER },
    { title: "Road Rage", description: "Complete every Criminal Convoy.", tier: SILVER },
    { title: "Enforcer", description: "Use the Crime Detection System to take down 20 confirmed criminals.", tier: BRONZE },
    { title: "Family Man", description: "Complete Act 1.", tier: BRONZE },
    { title: "Who Is Raymond Kenney?", description: "Complete Act 2.", tier: BRONZE },
    { title: "One Down, One to Go", description: "Complete Act 3.", tier: BRONZE },
    { title: "Vengeance", description: "Complete Act 4.", tier: SILVER },
    { title: "Log Off", description: "Complete Act 5.", tier: GOLD },
    { title: "Hard Crash", description: "Perform 10 vehicle take downs.", tier: BRONZE },
    {
      title: "Communication Fail",
      description: "Using non-lethal takedown, stop 10 civilians from calling to report you.",
      tier: BRONZE,
    },
    { title: "Bookmarked", description: "Tag 100 enemies.", tier: SILVER },
    { title: "Power Cycle", description: "Participate in 5 different City Games.", tier: BRONZE },
    { title: "Magic Smoke", description: "Kill 4 enemies within a single instance of Focus.", tier: BRONZE },
    { title: "Escape Loop", description: "Escape 15 police chases.", tier: BRONZE },
    { title: "Free Radical", description: "Escape a level 5 police chase.", tier: SILVER },
    { title: "White Rabbit Object", description: "Escape 15 police scans.", tier: SILVER },
    { title: "Scanproof", description: "Escape a level 5 police scan.", tier: SILVER },
    { title: "Hardware Fail", description: "Shoot out a tire on 15 different vehicles.", tier: SILVER },
    { title: "Black Hat Trick", description: "Kill 3 enemies with a single IED.", tier: SILVER },
    {
      title: "Revoking Client Privileges",
      description: "Complete the final mission in the Human Traffic Investigation.",
      tier: BRONZE,
    },
    {
      title: "Saturday Night Special",
      description: "Complete the final mission in the Weapons Trade Investigation.",
      tier: BRONZE,
    },
    { title: "Sanity Check", description: "Collect all 8 Burner Phones.", tier: BRONZE },
    { title: "Read-only", description: "Complete the final mission in the QR Code Investigation.", tier: BRONZE },
    {
      title: "Darkness Looms",
      description: "Complete the final mission of the Missing Persons Investigation.",
      tier: BRONZE,
    },
    { title: "Geolocated", description: "Check in at every Hotspot.", tier: SILVER },
    { title: "Disk Space Full", description: "Unlock every song with the SongSneak app.", tier: SILVER },
    { title: "Social Lubricant", description: "Complete level 10 against all 3 Drinking Game opponents.", tier: BRONZE },
    { title: "System Mangler", description: "Complete every ctOS Breach.", tier: SILVER },
    { title: "Freeware", description: "Unlock every Skill in the Skills Tree.", tier: GOLD },
    { title: "Clear Signals", description: "Unlock every ctOS Tower.", tier: SILVER },
  ],
};

const ONLINE_SET: SetSeed = {
  title: "Online trophies",
  countsTowardTrophy: false,
  achievements: [
    {
      title: "Hackification",
      description: "Invade and successfully hack 10 enemy Fixers in Online Hacking.",
      tier: SILVER,
    },
    {
      title: "Piggyback",
      description: "Invade and successfully observe 10 enemy Fixers in Online Tailing.",
      tier: SILVER,
    },
    { title: "Superhighway", description: "Complete 10 Public Online Races.", tier: BRONZE },
    { title: "Stealth Cookie", description: "Complete an Online Tailing without being detected.", tier: SILVER },
    { title: "Traced", description: "Get tailed 5 times.", tier: BRONZE },
  ],
};

const BAD_BLOOD_SET: SetSeed = {
  title: "Bad Blood",
  countsTowardTrophy: false,
  achievements: [
    { title: "T-Bone: Friends in Need", description: "Complete Act 1.", tier: BRONZE },
    { title: "T-Bone: No Easy Fix", description: "Complete Act 2.", tier: BRONZE },
    { title: "T-Bone: Pest Control", description: "Complete Act 3.", tier: BRONZE },
    { title: "T-Bone: Mob Ruled", description: "Complete 20 Chicago South Club contracts.", tier: BRONZE },
    { title: "T-Bone: Second Amendement", description: "Complete 20 Militia contracts.", tier: BRONZE },
    { title: "T-Bone: Unfixable", description: "Complete 20 Fixer contracts.", tier: BRONZE },
    { title: "T-Bone: Full Circuit", description: "Complete 29 driving missions.", tier: BRONZE },
    { title: "T-Bone: Tag Team", description: "Complete 10 coop missions.", tier: BRONZE },
    { title: "T-Bone: Looking For Trouble", description: "Complete all side investigations.", tier: BRONZE },
    { title: "T-Bone: Negative Eugenics", description: "Kill 4 enemies at once by blowing up the RC Car.", tier: BRONZE },
  ],
};

const SETS = [BASE_SET, ONLINE_SET, BAD_BLOOD_SET];
const EXPECTED = { "PSN Achievement Set": 35, "Online trophies": 5, "Bad Blood": 10 } as Record<string, number>;
// The whole PS4 list: 1 Platinum, 2 Gold, 19 Silver, 28 Bronze.
const EXPECTED_TIERS: Record<AchievementTier, number> = { PLATINUM: 1, GOLD: 2, SILVER: 19, BRONZE: 28 };

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
