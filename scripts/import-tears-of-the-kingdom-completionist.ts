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

// Switch and Switch 2 only, so there is no official list to copy. The Switch 2
// Edition's Zelda Notes medals live in the phone app and only count stats, so
// they aren't transcribed here.
const FAMILY_TITLE = "The Legend of Zelda: Tears of the Kingdom";
const SET_TITLE = "Completionist list";

type AchievementSeed = {
  title: string;
  description: string;
  tier: AchievementTier;
};

const { BRONZE, SILVER, GOLD, PLATINUM } = AchievementTier;

// Completion follows the game's own trackers: the Adventure Log (main quests,
// 60 side adventures, 31 shrine quests, 139 side quests, memories), the map
// percentage (shrines, Lightroots, Korok seeds, wells, caves and named places)
// and the 509-entry Hyrule Compendium, which has no amiibo-only entries.
// Robbie sells missing Compendium photos, so nothing is missable. King Gleeok
// and a Silver Lynel are the only optional fights on the list.
const ACHIEVEMENTS: AchievementSeed[] = [
  // Story
  { title: "Wind Rider", description: "Defeat Colgera and clear the Wind Temple with Tulin.", tier: BRONZE },
  { title: "Trial by Fire", description: "Defeat Marbled Gohma and clear the Fire Temple with Yunobo.", tier: BRONZE },
  { title: "Clean Water", description: "Defeat Mucktorok and clear the Water Temple with Sidon.", tier: BRONZE },
  { title: "Sand Queen", description: "Defeat Queen Gibdo and clear the Lightning Temple with Riju.", tier: BRONZE },
  { title: "Spirit Guide", description: "Clear the Spirit Temple with Mineru.", tier: SILVER },
  { title: "Tears of the Dragon", description: "Find every geoglyph and watch every memory in the Adventure Log.", tier: SILVER },
  { title: "Sword in the Sky", description: "Recover the Master Sword from the Light Dragon.", tier: SILVER },
  { title: "Yiga Dismissed", description: "Defeat Master Kohga in every one of his battles in the Depths.", tier: SILVER },
  { title: "Demon King's End", description: "Defeat Ganondorf and the Demon Dragon.", tier: GOLD },

  // Exploration
  { title: "Head in the Clouds", description: "Activate all 15 Skyview Towers.", tier: SILVER },
  { title: "Light of Blessing", description: "Complete all 152 shrines.", tier: GOLD },
  { title: "Root and Branch", description: "Activate all 120 Lightroots in the Depths.", tier: GOLD },
  { title: "Yahaha!", description: "Collect all 1,000 Korok seeds.", tier: GOLD },
  { title: "Well Traveled", description: "Explore all 58 wells.", tier: SILVER },
  { title: "Frog Prince", description: "Collect all 147 Bubbul Gems.", tier: SILVER },
  { title: "Fountain of Youth", description: "Restore all four Great Fairy Fountains.", tier: BRONZE },
  { title: "Every Corner", description: "Reach 100% map completion.", tier: GOLD },

  // Adventure Log
  { title: "Side Tracked", description: "Complete all 60 side adventures.", tier: GOLD },
  { title: "Odd Jobs", description: "Complete all 139 side quests.", tier: GOLD },
  { title: "Shrine Seeker", description: "Complete all 31 shrine quests.", tier: SILVER },

  // Compendium and gear
  { title: "Picture Perfect", description: "Fill all 509 entries in the Hyrule Compendium.", tier: GOLD },
  { title: "Dressed to Impress", description: "Upgrade every piece of one armor set to four stars.", tier: BRONZE },

  // Optional bosses
  { title: "Long Live the King", description: "Defeat King Gleeok.", tier: GOLD },
  { title: "Silver Lining", description: "Defeat a Silver Lynel.", tier: SILVER },

  // Capstone
  {
    title: "Hero of Hyrule",
    description:
      "Fully complete Tears of the Kingdom: every quest, shrine, Lightroot, Korok seed and Compendium entry, and 100% of the map.",
    tier: PLATINUM,
  },
];

async function main() {
  const apply = process.argv.includes("--apply");

  const titles = ACHIEVEMENTS.map((achievement) => achievement.title);
  const duplicates = titles.filter((title, index) => titles.indexOf(title) !== index);
  if (duplicates.length > 0) throw new Error(`Duplicate achievement titles: ${duplicates.join(", ")}`);
  if (ACHIEVEMENTS.length !== 25) throw new Error(`Expected 25 achievements, found ${ACHIEVEMENTS.length}`);

  const families = await prisma.gameFamily.findMany({
    where: { title: FAMILY_TITLE },
    select: { id: true, title: true },
  });
  if (families.length !== 1) {
    throw new Error(`Expected one family titled ${FAMILY_TITLE}, found ${families.length}`);
  }
  const family = families[0];

  const existingSet = await prisma.achievementSet.findFirst({
    where: { gameFamilyId: family.id, title: SET_TITLE, type: AchievementSetType.COMPLETIONIST },
    select: { id: true },
  });

  if (!apply) {
    console.log(`Would ${existingSet ? "update" : "create"} "${SET_TITLE}" for ${family.title} (${family.id})`);
    console.log(`${ACHIEVEMENTS.length} achievements. Dry run. Pass --apply to write.`);
    return;
  }

  const set =
    existingSet ??
    (await prisma.achievementSet.create({
      data: {
        title: SET_TITLE,
        type: AchievementSetType.COMPLETIONIST,
        visibility: AchievementSetVisibility.PUBLIC,
        gameFamilyId: family.id,
      },
      select: { id: true },
    }));
  console.log(`${existingSet ? "Reusing" : "Created"} "${SET_TITLE}" (${set.id}) for ${family.title}`);

  let created = 0;
  for (const achievement of ACHIEVEMENTS) {
    const data = { description: achievement.description, tier: achievement.tier };
    const result = await prisma.achievement.upsert({
      where: { achievementSetId_title: { achievementSetId: set.id, title: achievement.title } },
      update: data,
      create: { ...data, title: achievement.title, achievementSetId: set.id },
      select: { createdAt: true, updatedAt: true },
    });
    if (result.createdAt.getTime() === result.updatedAt.getTime()) created += 1;
  }

  console.log(`${ACHIEVEMENTS.length} achievements (${created} created, ${ACHIEVEMENTS.length - created} updated)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
