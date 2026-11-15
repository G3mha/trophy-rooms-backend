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

// Switch only, so there is no official list to copy.
const FAMILY_TITLE = "Metroid Dread";
const SET_TITLE = "Completionist set";

type AchievementSeed = {
  title: string;
  description: string;
  tier: AchievementTier;
};

const { BRONZE, SILVER, GOLD, PLATINUM } = AchievementTier;

const REGIONS = ["Artaria", "Cataris", "Dairon", "Burenia", "Ghavoran", "Elun", "Ferenia", "Hanubia"];

// Completion follows what the game itself rewards: a Chozo Archive image for
// 100% of the items in each region (and a ninth for all of them), the Ending
// Reward images for Normal and Hard clears under 8 and 4 hours, plus Dread
// Mode, Boss Rush and Dread Rush. Survival Rush has no finish line, Rookie
// Mode adds nothing, and amiibo bonuses need a purchase, so they're left out.
// The first Normal clear is the Raven Beak achievement.
const ACHIEVEMENTS: AchievementSeed[] = [
  // Story bosses
  { title: "Out of Sight", description: "Defeat Corpius in Artaria and take the Phantom Cloak.", tier: BRONZE },
  { title: "Old Rival", description: "Defeat Kraid.", tier: BRONZE },
  { title: "Deep Water", description: "Defeat Drogyga.", tier: BRONZE },
  { title: "Storm Front", description: "Defeat Escue and take the Storm Missile.", tier: SILVER },
  { title: "Failed Experiment", description: "Defeat Experiment No. Z-57.", tier: SILVER },
  { title: "Crossed Out", description: "Defeat Golzuna and take the Cross Bomb.", tier: SILVER },
  { title: "See You Next Mission", description: "Defeat Raven Beak and escape ZDR.", tier: GOLD },

  // E.M.M.I.
  { title: "Turning the Tables", description: "Destroy your first E.M.M.I. with the Omega Cannon.", tier: BRONZE },
  { title: "Extermination", description: "Destroy every E.M.M.I. that hunts you across ZDR.", tier: SILVER },

  // Chozo Archives: 100% items per region, then the whole planet
  ...REGIONS.map((region) => ({
    title: `${region} Archive`,
    description: `Collect every item in ${region}.`,
    tier: SILVER,
  })),
  { title: "Full Archive", description: "Collect every item on ZDR and unlock the final Chozo Archive.", tier: GOLD },

  // Ending Rewards
  { title: "Quick Study", description: "Finish Normal Mode in under 8 hours.", tier: SILVER },
  { title: "Speedrunner", description: "Finish Normal Mode in under 4 hours.", tier: SILVER },
  { title: "Hard Target", description: "Finish Hard Mode.", tier: SILVER },
  { title: "Hard and Fast", description: "Finish Hard Mode in under 8 hours.", tier: SILVER },
  { title: "No Time to Spare", description: "Finish Hard Mode in under 4 hours.", tier: GOLD },

  // Dread Mode and the rush modes
  { title: "Fear Itself", description: "Finish Dread Mode, where a single hit ends the run.", tier: GOLD },
  { title: "Gauntlet", description: "Complete Boss Rush.", tier: SILVER },
  { title: "Untouchable", description: "Complete Dread Rush, all 12 bosses where a single hit ends the run.", tier: GOLD },

  // Capstone
  {
    title: "Last Metroid",
    description: "Fully complete Metroid Dread: every item, archive, Ending Reward, Dread Mode and Dread Rush.",
    tier: PLATINUM,
  },
];

async function main() {
  const apply = process.argv.includes("--apply");

  const titles = ACHIEVEMENTS.map((achievement) => achievement.title);
  const duplicates = titles.filter((title, index) => titles.indexOf(title) !== index);
  if (duplicates.length > 0) throw new Error(`Duplicate achievement titles: ${duplicates.join(", ")}`);
  if (ACHIEVEMENTS.length !== 27) throw new Error(`Expected 27 achievements, found ${ACHIEVEMENTS.length}`);

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
