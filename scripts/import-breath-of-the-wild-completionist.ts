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

// Wii U, Switch and Switch 2 only, so there is no official list to copy. The
// Switch 2 Edition's Zelda Notes medals live in the phone app and only count
// stats, so they aren't transcribed here.
const FAMILY_TITLE = "The Legend of Zelda: Breath of the Wild";

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

// The base game follows its own trackers: the Adventure Log (main quests, 76
// side quests, 42 shrine quests, memories), the map percentage (shrines,
// Korok seeds and named places) and the 385-entry Hyrule Compendium, which has
// no amiibo-only entries. Symin sells missing Compendium photos, so nothing is
// missable. Kilton's three Medals of Honor are the game's own tally of the big
// field bosses.
const BASE_SET: SetSeed = {
  title: "Completionist list",
  countsTowardTrophy: true,
  achievements: [
    // Story
    { title: "Off the Plateau", description: "Get the paraglider and leave the Great Plateau.", tier: BRONZE },
    { title: "Mipha's Grace", description: "Free Divine Beast Vah Ruta and defeat Waterblight Ganon.", tier: BRONZE },
    { title: "Daruk's Protection", description: "Free Divine Beast Vah Rudania and defeat Fireblight Ganon.", tier: BRONZE },
    { title: "Revali's Gale", description: "Free Divine Beast Vah Medoh and defeat Windblight Ganon.", tier: BRONZE },
    { title: "Urbosa's Fury", description: "Free Divine Beast Vah Naboris and defeat Thunderblight Ganon.", tier: BRONZE },
    { title: "Yiga Takedown", description: "Defeat Master Kohga in the Yiga Clan Hideout.", tier: BRONZE },
    { title: "Recovered Memories", description: "Find every memory in the Adventure Log.", tier: SILVER },
    { title: "The Sword Chooses You", description: "Draw the Master Sword in Korok Forest.", tier: SILVER },
    { title: "Calamity's End", description: "Defeat Calamity Ganon and Dark Beast Ganon.", tier: GOLD },

    // Exploration
    { title: "Tower Climber", description: "Activate all 15 Sheikah Towers.", tier: SILVER },
    { title: "Spirit Orbs", description: "Complete all 120 shrines.", tier: GOLD },
    { title: "Hestu's Gift", description: "Collect all 900 Korok seeds.", tier: GOLD },
    { title: "Fairy Godmothers", description: "Restore all four Great Fairy Fountains.", tier: BRONZE },
    { title: "Mapped Out", description: "Reach 100% map completion.", tier: GOLD },

    // Adventure Log
    { title: "Good Samaritan", description: "Complete all 76 side quests.", tier: GOLD },
    { title: "Trailblazer", description: "Complete all 42 shrine quests.", tier: SILVER },

    // Compendium and gear
    { title: "Classified", description: "Fill all 385 entries in the Hyrule Compendium.", tier: GOLD },
    { title: "Dressed to Impress", description: "Upgrade every piece of one armor set to four stars.", tier: BRONZE },

    // Optional fights
    { title: "Lynel Hunter", description: "Defeat a Silver Lynel.", tier: SILVER },
    { title: "Big Game", description: "Defeat all 40 Hinox and Stalnox and earn Kilton's Medal of Honor: Hinox.", tier: SILVER },
    { title: "Rock Solid", description: "Defeat all 40 Stone Talus and earn Kilton's Medal of Honor: Talus.", tier: SILVER },
    { title: "Sand Shark", description: "Defeat all 4 Molduga and earn Kilton's Medal of Honor: Molduga.", tier: SILVER },

    // Capstone
    {
      title: "Champion of Hyrule",
      description:
        "Fully complete Breath of the Wild: every quest, shrine, Korok seed and Compendium entry, and 100% of the map.",
      tier: PLATINUM,
    },
  ],
};

// The paid Expansion Pass. Visible and tickable, but it doesn't gate the
// trophy, since the base game shouldn't need a purchase to finish.
const DLC_SET: SetSeed = {
  title: "Expansion Pass",
  countsTowardTrophy: false,
  achievements: [
    { title: "Beginning Trials", description: "Clear the Beginning Trials of the Trial of the Sword.", tier: BRONZE },
    { title: "Middle Trials", description: "Clear the Middle Trials of the Trial of the Sword.", tier: SILVER },
    { title: "Blade Awakened", description: "Clear the Final Trials and fully power up the Master Sword.", tier: GOLD },
    { title: "Master Mode", description: "Defeat Calamity Ganon in Master Mode.", tier: GOLD },
    { title: "One-Hit Wonder", description: "Clear all 16 Champions' Ballad shrines.", tier: SILVER },
    { title: "Blight Rematch", description: "Defeat all four Blight Ganons again in the Champions' Ballad.", tier: SILVER },
    { title: "Master Cycle", description: "Defeat Monk Maz Koshia in the Final Trial and unlock the Master Cycle Zero.", tier: GOLD },
  ],
};

const SETS = [BASE_SET, DLC_SET];
const EXPECTED = { "Completionist list": 23, "Expansion Pass": 7 } as Record<string, number>;

async function main() {
  const apply = process.argv.includes("--apply");

  for (const set of SETS) {
    const titles = set.achievements.map((achievement) => achievement.title);
    const duplicates = titles.filter((title, index) => titles.indexOf(title) !== index);
    if (duplicates.length > 0) throw new Error(`Duplicate titles in ${set.title}: ${duplicates.join(", ")}`);
    if (set.achievements.length !== EXPECTED[set.title]) {
      throw new Error(`Expected ${EXPECTED[set.title]} achievements in ${set.title}, found ${set.achievements.length}`);
    }
  }

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
      where: { gameFamilyId: family.id, title: seed.title, type: AchievementSetType.COMPLETIONIST },
      select: { id: true },
    });

    if (!apply) {
      console.log(
        `Would ${existingSet ? "update" : "create"} "${seed.title}" for ${family.title} (${family.id}): ` +
          `${seed.achievements.length} achievements, ${seed.countsTowardTrophy ? "gates" : "doesn't gate"} the trophy`,
      );
      continue;
    }

    const set =
      existingSet ??
      (await prisma.achievementSet.create({
        data: {
          title: seed.title,
          type: AchievementSetType.COMPLETIONIST,
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
    console.log(`${seed.achievements.length} achievements (${created} created, ${seed.achievements.length - created} updated)`);
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
