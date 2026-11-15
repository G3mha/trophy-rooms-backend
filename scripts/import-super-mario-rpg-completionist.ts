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

// The 2023 Switch remake. The SNES original is its own family,
// "Super Mario RPG: Legend of the Seven Stars".
const FAMILY_TITLE = "Super Mario RPG";
const SET_TITLE = "Completionist list";

type AchievementSeed = {
  title: string;
  description: string;
  tier: AchievementTier;
};

const { BRONZE, SILVER, GOLD, PLATINUM } = AchievementTier;

// Completion follows what guides count as a 100% clear and the game's own Play
// Report: every post-game rematch, all 39 hidden treasures, all nine gold
// medals (casino included), the full Monster List, Scrapbook and Sound Player,
// 100 Super Jumps for the Super Suit, and the whole party at the level cap.
// Gold medal descriptions carry no thresholds because guides disagree on them;
// the game shows the medal itself.
const ACHIEVEMENTS: AchievementSeed[] = [
  // Story: the seven Star Pieces
  { title: "Castle Cleanup", description: "Recover the Star Piece in Mushroom Castle.", tier: BRONZE },
  { title: "Out of the Woods", description: "Recover the Star Piece from Bowyer in the Forest Maze.", tier: BRONZE },
  { title: "Mine Blast", description: "Recover the Star Piece from Punchinello in the Moleville mines.", tier: BRONZE },
  { title: "Wishing Star", description: "Recover the Star Piece on Star Hill.", tier: BRONZE },
  { title: "High Tide", description: "Recover the Star Piece from Speardovich in Seaside Town.", tier: SILVER },
  { title: "Rangers Down", description: "Defeat the Axem Rangers aboard the Blade and recover the Star Piece.", tier: SILVER },
  { title: "Star Road Restored", description: "Defeat Smithy and restore the Star Road.", tier: GOLD },

  // Secret bosses
  { title: "New Sensei", description: "Defeat Jinx all three times at the Monstro Town dojo.", tier: SILVER },
  { title: "Crystal Clear", description: "Defeat Culex behind the sealed door in Monstro Town.", tier: GOLD },

  // Post-game rematches. Culex 3D only opens once the others are beaten.
  { title: "Sore Throat", description: "Defeat Scratchy-Throat Belome at Belome Temple.", tier: SILVER },
  { title: "Bigger Bang", description: "Defeat Leveled-Up Punchinello in Moleville.", tier: SILVER },
  { title: "Engine Trouble", description: "Defeat Engine 023 Booster at the top of Booster Tower.", tier: SILVER },
  { title: "Cake Walk", description: "Defeat Extra-Fancy Bundt and Extra-Fancy Raspberry in Marrymore.", tier: SILVER },
  { title: "Walk the Plank", description: "Defeat Duel-Ready Johnny in the Sunken Ship.", tier: SILVER },
  { title: "Master Class", description: "Defeat Mario-Style Jinx at the Monstro Town dojo.", tier: SILVER },
  { title: "Third Dimension", description: "Defeat Culex 3D, the final rematch.", tier: GOLD },

  // Collecting and the Journal
  { title: "Finders Keepers", description: "Find your first hidden treasure.", tier: BRONZE },
  { title: "Every Last Chest", description: "Find all 39 hidden treasures.", tier: GOLD },
  { title: "Know Your Enemy", description: "Complete all 235 Monster List entries and receive the Monster Trophy.", tier: GOLD },
  { title: "Memory Lane", description: "Fill every entry in the Scrapbook.", tier: SILVER },
  { title: "Encore", description: "Fill every track in the Sound Player.", tier: SILVER },

  // Super Jumps and levels
  { title: "Spring Loaded", description: "Land 30 Super Jumps in a row and earn the Attack Scarf.", tier: SILVER },
  { title: "Super Suited", description: "Land 100 Super Jumps in a row and earn the Super Suit.", tier: GOLD },
  { title: "Full Party", description: "Raise Mario, Mallow, Geno, Bowser and Peach to level 30.", tier: GOLD },

  // The nine gold medals the Play Report tracks
  { title: "Midas Touch", description: "Earn the gold medal in Midas River.", tier: SILVER },
  { title: "Thump Champ", description: "Earn the gold medal in Goomba Thump.", tier: SILVER },
  { title: "Off the Rails", description: "Earn the gold medal in the Mine-Car Race.", tier: SILVER },
  { title: "Beetle Racer", description: "Earn the gold medal in the Beetle Race at Booster Hill.", tier: SILVER },
  { title: "Sky High", description: "Earn the gold medal in the Paratroopa minigame.", tier: SILVER },
  { title: "Bug Out", description: "Earn the gold medal in Beetle Mania.", tier: SILVER },
  { title: "Juggling Act", description: "Earn the gold medal in Grate Guy's Casino juggling game.", tier: SILVER },
  { title: "Total Recall", description: "Earn the gold medal in the casino Memory Game.", tier: SILVER },
  { title: "Look Away", description: "Earn the gold medal in Look the Other Way.", tier: SILVER },

  // Capstone
  {
    title: "Legend of the Seven Stars",
    description: "Fully complete Super Mario RPG: every rematch, treasure, gold medal and Journal entry.",
    tier: PLATINUM,
  },
];

async function main() {
  const apply = process.argv.includes("--apply");

  const titles = ACHIEVEMENTS.map((achievement) => achievement.title);
  const duplicates = titles.filter((title, index) => titles.indexOf(title) !== index);
  if (duplicates.length > 0) throw new Error(`Duplicate achievement titles: ${duplicates.join(", ")}`);
  if (ACHIEVEMENTS.length !== 34) throw new Error(`Expected 34 achievements, found ${ACHIEVEMENTS.length}`);

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
