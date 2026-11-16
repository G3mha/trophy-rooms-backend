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

// Switch 2 only, with no official achievement list to copy.
const FAMILY_TITLE = "Pokémon Pokopia";

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

// A full clear of the base game, following the game's own trackers: the
// story's Important Requests and the nine Team Initiation Challenge badges,
// Environment Level 10 in all five base regions, the 300-entry main Pokédex
// (which holds all 12 legendaries and Mew), the 209-entry main Habitat Dex and
// the Developer Room diploma, plus every CD, fossil piece and Human Record.
// Left out because they're timed or online: the separate Event Pokédex and its
// habitats, Cloud Islands (Nintendo Switch Online) and the weekly stamp cards.
const BASE_SET: SetSeed = {
  title: "Completionist list",
  countsTowardTrophy: true,
  achievements: [
    // Story
    {
      title: "Rainmaker",
      description: "Complete Yawn Up A Storm in the Withered Wastelands and bring Kyogre's rain.",
      tier: BRONZE,
    },
    { title: "Power Up", description: "Complete Brighten Things Up in Bleak Beach and wake Mosslax.", tier: BRONZE },
    { title: "Party Starter", description: "Complete Time To Party in Rocky Ridges and meet Volcanion.", tier: BRONZE },
    {
      title: "Skyscraper",
      description: "Complete Rebuild the Huge Building in the Sparkling Skylands and meet Mewtwo.",
      tier: SILVER,
    },
    {
      title: "Open for Business",
      description:
        "Restore the Pokémon Centers in the Withered Wastelands, Bleak Beach, Rocky Ridges and Sparkling Skylands.",
      tier: BRONZE,
    },
    { title: "Badge Case", description: "Earn all nine badges in the Team Initiation Challenge.", tier: SILVER },
    { title: "Blast Off", description: "Finish the story and watch the rocket launch.", tier: GOLD },
    {
      title: "Magnetic Personality",
      description: "Find the Magnemite under the launch site and learn Magnet Rise.",
      tier: BRONZE,
    },

    // Environment Level 10 in every base region
    { title: "Wasteland Bloom", description: "Raise the Withered Wastelands to Environment Level 10.", tier: SILVER },
    { title: "Bright Beach", description: "Raise Bleak Beach to Environment Level 10.", tier: SILVER },
    { title: "Ridge Revival", description: "Raise Rocky Ridges to Environment Level 10.", tier: SILVER },
    { title: "Sky High", description: "Raise the Sparkling Skylands to Environment Level 10.", tier: SILVER },
    { title: "Town Pride", description: "Raise Palette Town to Environment Level 10.", tier: SILVER },

    // Pokédex and habitats
    { title: "Making Friends", description: "Register 50 Pokémon in the main Pokédex.", tier: BRONZE },
    { title: "Halfway Home", description: "Register 150 Pokémon in the main Pokédex.", tier: SILVER },
    { title: "Full Pokédex", description: "Register all 300 Pokémon in the main Pokédex.", tier: GOLD },
    {
      title: "Diploma",
      description: "Open the Developer Room in the Sparkling Skylands and print your Pokédex diploma.",
      tier: SILVER,
    },
    { title: "Habitat Expert", description: "Discover all 209 habitats in the main Habitat Dex.", tier: GOLD },

    // Legendary and Mythical Pokémon
    {
      title: "Bird Watching",
      description:
        "Build the Freezing Chambers, Abandoned Power Plant and Altar of the Flame in Palette Town and befriend Articuno, Zapdos and Moltres.",
      tier: SILVER,
    },
    { title: "Legendary Beasts", description: "Befriend Raikou, Entei and Suicune.", tier: SILVER },
    { title: "Tidal Bell", description: "Ring the Tidal Bell to call down Lugia and befriend it.", tier: SILVER },
    { title: "Clear Bell", description: "Ring the Clear Bell to call down Ho-Oh and befriend it.", tier: SILVER },
    { title: "Encore", description: "Throw a second party in Rocky Ridges so Volcanion moves in.", tier: BRONZE },
    { title: "Dream Guest", description: "Find Mewtwo on a Dream Island and befriend it.", tier: SILVER },
    {
      title: "Picture Perfect",
      description: "Place all 27 Mysterious Slates at the ruins in the Withered Wastelands and befriend Mew.",
      tier: GOLD,
    },

    // Collecting
    { title: "Sweet Dreams", description: "Visit a Dream Island with Drifloon's help.", tier: BRONZE },
    { title: "Fossil Record", description: "Find all 22 fossil pieces and assemble all nine fossils.", tier: SILVER },
    { title: "Greatest Hits", description: "Collect all 43 Music CDs.", tier: GOLD },
    { title: "Paper Trail", description: "Find every Human Record in the base game.", tier: GOLD },

    // Capstone
    {
      title: "Pokémon Paradise",
      description:
        "Fully complete Pokémon Pokopia: every region at Environment Level 10, the full Pokédex and Habitat Dex, and every legendary, CD, fossil and Human Record.",
      tier: PLATINUM,
    },
  ],
};

// The paid Expansion Pass. Visible and tickable, but it doesn't gate the
// trophy, since the base game shouldn't need a purchase to finish. Bubbly
// Basin (pack 1) is the only pack with content so far; later packs go here.
const DLC_SET: SetSeed = {
  title: "Expansion Pass",
  countsTowardTrophy: false,
  achievements: [
    {
      title: "Ocean Temple",
      description: "Complete Build the Beautiful Building in Bubbly Basin and meet Manaphy.",
      tier: SILVER,
    },
    { title: "Basin Pokédex", description: "Register all 50 Pokémon in the Basin Pokédex.", tier: GOLD },
    { title: "Reef Builder", description: "Discover all 36 habitats in the Basin Habitat Dex.", tier: SILVER },
    {
      title: "X Marks the Spot",
      description: "Find the treasure from all six Treasure Maps and build Mermaid's Gym.",
      tier: SILVER,
    },
    { title: "Sea Dreamer", description: "Find Phione on a Dream Island and befriend it.", tier: SILVER },
    { title: "Basin in Bloom", description: "Raise Bubbly Basin to Environment Level 10.", tier: SILVER },
  ],
};

const SETS = [BASE_SET, DLC_SET];
const EXPECTED = { "Completionist list": 30, "Expansion Pass": 6 } as Record<string, number>;

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
