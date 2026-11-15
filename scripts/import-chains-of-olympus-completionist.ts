/**
 * Create the completionist trophy list for God of War: Chains of Olympus.
 *
 * The catalog has the PSP release, which never had trophies. Completion here
 * follows what the game itself tracks: the story from Attica to Persephone,
 * every Gorgon Eye and Phoenix Feather, every weapon and magic at max level,
 * God difficulty (unlocked by a first clear) and the Challenge of Hades, plus
 * the two optional secrets and playing in an unlocked costume.
 *
 * Facts were checked against two lists made for the same game: the PS3 HD
 * release's PSN trophies (NPWR02070_00) and the PSP RetroAchievements set
 * (game 3537). Left out on purpose:
 * - RetroAchievements' own challenge runs (no-damage bosses, no-upgrade God
 *   run, under 2 hours). The game doesn't track or reward them.
 * - PSN's combat counters (50 parries, 50 Satyr kills, breaking out of stone
 *   five times) and joke trophies. Only the 1,000-hit combo is kept, since
 *   both lists ask for it.
 *
 * Titles and descriptions are our own. Icons are the RetroAchievements
 * badges for the same moments, linked from their server like the other lists
 * built from RetroAchievements. Those badges are 64px. The Platinum uses the
 * game's RetroAchievements icon, like the other Platinums on such lists.
 *
 *   npx tsx scripts/import-chains-of-olympus-completionist.ts          # dry run
 *   npx tsx scripts/import-chains-of-olympus-completionist.ts --apply
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

const FAMILY_SLUG = "god-of-war-chains-of-olympus";
const SET_TITLE = "Completionist list";
const BADGE_BASE = "https://media.retroachievements.org/Badge/";
const GAME_ICON = "https://media.retroachievements.org/Images/120499.png";

type AchievementSeed = {
  title: string;
  description: string;
  tier: AchievementTier;
  badge?: string;
};

const { BRONZE, SILVER, GOLD, PLATINUM } = AchievementTier;

const ACHIEVEMENTS: AchievementSeed[] = [
  // Story, in order
  { title: "Shores of Attica", description: "Defend the shores of Attica from the Persian fleet.", tier: BRONZE, badge: "274098" },
  { title: "Driven Back", description: "Fire the ballista and drive the Basilisk into retreat.", tier: BRONZE, badge: "274092" },
  { title: "King of Persia", description: "Defeat the Persian King and take the Efreet.", tier: BRONZE, badge: "274090" },
  { title: "Basilisk Slain", description: "Defeat the Basilisk.", tier: BRONZE, badge: "274093" },
  { title: "Temple of Helios", description: "Reach the Temple of Helios.", tier: BRONZE, badge: "274094" },
  { title: "Sun Shield", description: "Acquire the Sun Shield.", tier: BRONZE, badge: "274095" },
  { title: "Triton's Lance", description: "Acquire Triton's Lance.", tier: BRONZE, badge: "274096" },
  { title: "Light of Dawn", description: "Acquire the Primordial Fire and the Light of Dawn.", tier: BRONZE, badge: "274097" },
  { title: "Fire Steeds", description: "Awaken all three Fire Steeds.", tier: BRONZE, badge: "274089" },
  { title: "Gauntlet of Zeus", description: "Acquire the Gauntlet of Zeus.", tier: BRONZE, badge: "274100" },
  { title: "Out of Tartarus", description: "Fight through Tartarus and escape it.", tier: BRONZE, badge: "274102" },
  { title: "The Ferryman", description: "Defeat Charon and take Charon's Wrath.", tier: SILVER, badge: "274103" },
  { title: "Fields of Elysium", description: "Give up your powers in the Fields of Elysium.", tier: BRONZE, badge: "274104" },
  { title: "Ghost of Sparta", description: "Take your powers back.", tier: BRONZE, badge: "274105" },
  { title: "Atlas Bound", description: "Defeat Atlas and chain him to the world.", tier: SILVER, badge: "274106" },
  { title: "Queen of the Underworld", description: "Defeat Persephone and finish the game.", tier: GOLD, badge: "274107" },

  // Optional secrets
  { title: "Royal Company", description: "Fully entertain the Persian King's harem.", tier: BRONZE, badge: "274109" },
  { title: "Hidden in Attica", description: "Find the secret area in Attica.", tier: BRONZE, badge: "274087" },

  // Everything collected and upgraded
  { title: "Every Gorgon Eye", description: "Collect all of the Gorgon Eyes.", tier: SILVER, badge: "274078" },
  { title: "Every Phoenix Feather", description: "Collect all of the Phoenix Feathers.", tier: SILVER, badge: "274079" },
  { title: "Full Arsenal", description: "Upgrade every weapon and magic to its max level.", tier: GOLD, badge: "274077" },

  // Feats and modes
  { title: "Thousand Cuts", description: "Perform a 1,000-hit combo.", tier: SILVER, badge: "274072" },
  { title: "Dressed for War", description: "Play the game in an unlocked costume.", tier: BRONZE, badge: "274108" },
  { title: "Challenge of Hades", description: "Beat the Challenge of Hades.", tier: GOLD, badge: "274084" },
  { title: "God Among Men", description: "Beat the game on God difficulty.", tier: GOLD, badge: "274088" },

  // Capstone
  {
    title: "Champion of Olympus",
    description:
      "Fully complete God of War: Chains of Olympus: God difficulty, the Challenge of Hades, every Gorgon Eye, Phoenix Feather and upgrade.",
    tier: PLATINUM,
  },
];

function assertShape() {
  const titles = ACHIEVEMENTS.map((achievement) => achievement.title);
  const duplicates = titles.filter((title, index) => titles.indexOf(title) !== index);
  if (duplicates.length > 0) throw new Error(`Duplicate titles: ${duplicates.join(", ")}`);

  const badges = ACHIEVEMENTS.flatMap((achievement) => (achievement.badge ? [achievement.badge] : []));
  if (new Set(badges).size !== badges.length) throw new Error("Two trophies share a badge");

  const count = (tier: AchievementTier) => ACHIEVEMENTS.filter((a) => a.tier === tier).length;
  const shape = [PLATINUM, GOLD, SILVER, BRONZE].map(count).join("/");
  if (shape !== "1/4/5/16") throw new Error(`Expected 1/4/5/16 trophies by tier, got ${shape}`);

  for (const achievement of ACHIEVEMENTS) {
    if (achievement.description.length > 150) throw new Error(`${achievement.title}: description over 150 characters`);
    if (/achievement|—|;/i.test(achievement.title + achievement.description)) {
      throw new Error(`${achievement.title}: uses a banned word or mark`);
    }
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  assertShape();

  const iconFor = (achievement: AchievementSeed) => (achievement.badge ? `${BADGE_BASE}${achievement.badge}.png` : GAME_ICON);
  for (const achievement of ACHIEVEMENTS) {
    const response = await fetch(iconFor(achievement), { method: "HEAD" });
    if (!response.ok) throw new Error(`Icon not reachable (${response.status}): ${iconFor(achievement)}`);
  }

  const family = await prisma.gameFamily.findFirst({
    where: { slug: FAMILY_SLUG },
    select: { id: true, title: true },
  });
  if (!family) throw new Error(`No family with slug ${FAMILY_SLUG}`);

  const existingSet = await prisma.achievementSet.findFirst({
    where: { gameFamilyId: family.id, title: SET_TITLE, type: AchievementSetType.COMPLETIONIST },
    select: { id: true },
  });

  if (!apply) {
    console.log(`Would ${existingSet ? "update" : "create"} "${SET_TITLE}" for ${family.title} (${family.id})`);
    console.log(`${ACHIEVEMENTS.length} trophies. Dry run. Pass --apply to write.`);
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
    const data = { description: achievement.description, tier: achievement.tier, iconUrl: iconFor(achievement) };
    const result = await prisma.achievement.upsert({
      where: { achievementSetId_title: { achievementSetId: set.id, title: achievement.title } },
      update: data,
      create: { ...data, title: achievement.title, achievementSetId: set.id },
      select: { createdAt: true, updatedAt: true },
    });
    if (result.createdAt.getTime() === result.updatedAt.getTime()) created += 1;
  }

  console.log(`${ACHIEVEMENTS.length} trophies (${created} created, ${ACHIEVEMENTS.length - created} updated)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
