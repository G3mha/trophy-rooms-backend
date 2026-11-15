/**
 * Import the official Watch Dogs 2 trophy list, split three ways.
 *
 * The PS4 list (NPWR10664_00) has 56 trophies: the base game's 50 (1 Platinum
 * / 1 Gold / 14 Silver / 34 Bronze) and three DLC groups outside the
 * Platinum, each Silver: Human Conditions (4), No Compromise (1) and the free
 * Showd0wn mode (1). Steam ships the same 55 without the Platinum
 * (GetGlobalAchievementPercentagesForApp reports 55 for app 447040), so the
 * PSN list is the superset. Titles are PSN's own.
 *
 * Online is never required for a Trophy Rooms trophy, so the five base
 * trophies that need other players (DedSec Events, Bounty Hunter, online
 * co-op and Hacking Invasion) and Showd0wn's PvP trophy go in their own list
 * that doesn't gate the trophy. Human Conditions and No Compromise share one
 * story DLC list that doesn't gate it either, matching PSN. That keeps Prize
 * Catch, whose Off the Hook mission is co-op, optional too.
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

const FAMILY_TITLE = "Watch Dogs 2";

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
  title: "PSN Trophy List",
  countsTowardTrophy: true,
  achievements: [
    { title: "Graduation Day", description: "Win every trophy.", tier: PLATINUM },
    { title: "Who Am I", description: "Erase your past identity in the Blume servers.", tier: BRONZE },
    { title: "Put Your Damn Pants On", description: "Buy some pants after the party.", tier: BRONZE },
    { title: "Menace", description: "Buy a two handed weapon at the 3D printer.", tier: BRONZE },
    { title: "In Style", description: "Buy the Gatorfeet Whine Country footwear.", tier: BRONZE },
    { title: "DedSec-A-Roni", description: "Ride a cable car.", tier: BRONZE },
    { title: "Only God Can Judge Me", description: "Buy a shirt in the Nudle vending machine.", tier: BRONZE },
    { title: "Doggyland", description: "Pet 10 dogs.", tier: BRONZE },
    { title: "Photobombed!", description: "Get photobombed in a selfie.", tier: BRONZE },
    { title: "A Ride to Remember", description: "Drive one of the Unique Vehicles.", tier: BRONZE },
    { title: "Bad Boys", description: "Hijack a boat.", tier: BRONZE },
    { title: "Something To Ride", description: "Hijack a bus.", tier: BRONZE },
    { title: "Researcher", description: "Collect all the Key Data hidden in the world.", tier: SILVER },
    { title: "Smooth Felon", description: "Escape a Level 5 felony.", tier: BRONZE },
    {
      title: "Miniroadtrip!",
      description: "Drive 4 km in the world while driving the Merengue from Elek Motors.",
      tier: BRONZE,
    },
    { title: "Knock You Out", description: "Do a stealth takedown on 30 enemies.", tier: BRONZE },
    { title: "Jump Around", description: "Do a 140 meters long jump while driving a vehicle.", tier: BRONZE },
    { title: "Earn your Sea Legs", description: "Do a sailboat race.", tier: BRONZE },
    { title: "Roboteer", description: "Hack a robot.", tier: BRONZE },
    { title: "Third Time's the Charm", description: "Make 3 jumps in a row aboard a vehicle.", tier: BRONZE },
    { title: "Hold My Hair", description: "Take a picture of someone vomiting.", tier: BRONZE },
    { title: "Let Me Ride", description: "Travel 200 meters on top of a car by hacking it.", tier: BRONZE },
    {
      title: "Feeding Frenzy",
      description: "Use the \"Call the cops\" hack on the donut-disguised man in Haight-Ashbury.",
      tier: BRONZE,
    },
    { title: "Got The Shutterbug", description: "Take 25 ScoutX location pictures.", tier: BRONZE },
    { title: "One-Man Garage", description: "Buy 25 cars in car dealerships.", tier: BRONZE },
    { title: "Pimp My eKart", description: "Get all the eKart upgrades.", tier: BRONZE },
    { title: "App'ing Around", description: "Buy all the apps in the App Shop.", tier: BRONZE },
    { title: "I Get Around", description: "Do a drone race.", tier: BRONZE },
    { title: "Ain't No Stopping", description: "Do a bike race.", tier: BRONZE },
    { title: "The Fox", description: "Finish Operation: Shadow.", tier: BRONZE },
    { title: "Joined the Mile High Club", description: "Finish Operation: Hack teh World.", tier: SILVER },
    { title: "Picking Up the Pieces", description: "Finish Operation: Looking Glass.", tier: SILVER },
    { title: "Baby, I Got Your Money", description: "Finish Operation: False Profits.", tier: SILVER },
    { title: "Knight Ridden", description: "Finish Operation: Cyber Driver.", tier: SILVER },
    { title: "No Place Like Haum", description: "Finish Operation: Haum Sweet Haum.", tier: SILVER },
    { title: "Informer", description: "Finish Operation: Limp Nudle.", tier: SILVER },
    { title: "100% Legit", description: "Finish Operation: $911.", tier: SILVER },
    { title: "Hypnotize", description: "Finish Operation: W4tched.", tier: SILVER },
    { title: "Old School Justice", description: "Finish Operation: Eye for An Eye.", tier: SILVER },
    { title: "Sabotage", description: "Finish Operation: Hacker War.", tier: SILVER },
    { title: "Make Every Voice Count", description: "Finish Operation: Power to the Sheeple.", tier: SILVER },
    { title: "The Itsy Bitsy Spider", description: "Finish Operation: Robot Wars.", tier: SILVER },
    { title: "You're On A Boat!", description: "Finish Operation: Shanghaied.", tier: SILVER },
    { title: "Leaks and Leaks", description: "Finish Operation: Ubistolen.", tier: BRONZE },
    { title: "Hack the World", description: "Trigger the hack of the century.", tier: GOLD },
  ],
};

// The base game's five, then Showd0wn's.
const ONLINE_SET: SetSeed = {
  title: "Online trophies",
  countsTowardTrophy: false,
  achievements: [
    { title: "One of the Gang", description: "Complete 5 DedSec Events.", tier: BRONZE },
    { title: "Natural Born Killer", description: "Neutralize 1 Hunter in Bounty Hunter mode.", tier: BRONZE },
    {
      title: "Please Marcus, Don't Hurt Them",
      description: "Successfully neutralize 5 fugitives in Bounty Hunter.",
      tier: BRONZE,
    },
    { title: "Hold My Hand", description: "Successfully complete an online Co-op Operation.", tier: BRONZE },
    { title: "Troll'r", description: "Successfully invade another hacker.", tier: BRONZE },
    { title: "It's the Final Showd0wn", description: "Reach the maximum win streak bonus in Showd0wn.", tier: SILVER },
  ],
};

// Human Conditions, then No Compromise.
const STORY_DLC_SET: SetSeed = {
  title: "Story DLC",
  countsTowardTrophy: false,
  achievements: [
    { title: "Not the Pizza Guy", description: "Finish Operation: Bad Medicine.", tier: SILVER },
    { title: "The Score of Your Life", description: "Finish Operation: Automata.", tier: SILVER },
    { title: "Nanotriumph", description: "Finish Operation: Caustic Progress.", tier: SILVER },
    { title: "Prize Catch", description: "Finish Operation: Off the Hook.", tier: SILVER },
    { title: "That Escalated Quickly", description: "Finish Operation: Moscow Gambit.", tier: SILVER },
  ],
};

const SETS = [BASE_SET, ONLINE_SET, STORY_DLC_SET];
const EXPECTED = { "PSN Trophy List": 45, "Online trophies": 6, "Story DLC": 5 } as Record<string, number>;
// The whole PS4 list: 1 Platinum, 1 Gold, 20 Silver, 34 Bronze.
const EXPECTED_TIERS: Record<AchievementTier, number> = { PLATINUM: 1, GOLD: 1, SILVER: 20, BRONZE: 34 };

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
