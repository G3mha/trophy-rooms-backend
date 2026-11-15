/**
 * Import Elden Ring's official trophy list.
 *
 * PS4 (NPWR25264_00) and PS5 (NPWR25067_00) ship the same list of 42
 * trophies: 1 Platinum, 3 Gold, 14 Silver and 24 Bronze, all in one group.
 * Shadow of the Erdtree added no trophies. Titles and descriptions are PSN's
 * own, including the Platinum's "Obtained all trophies".
 *
 * Nothing on the list needs online play, so it all goes in one list that
 * gates the Platinum.
 *
 *   npx tsx scripts/import-elden-ring-trophies.ts          # dry run
 *   npx tsx scripts/import-elden-ring-trophies.ts --apply
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

const FAMILY_TITLE = "Elden Ring";

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
    { title: "Elden Ring", description: "Obtained all trophies", tier: PLATINUM },
    { title: "Elden Lord", description: "Achieved the \"Elden Lord\" ending", tier: GOLD },
    { title: "Age of the Stars", description: "Achieved the \"Age of the Stars\" ending", tier: GOLD },
    { title: "Lord of Frenzied Flame", description: "Achieved the \"Lord of Frenzied Flame\" ending", tier: GOLD },
    { title: "Shardbearer Godrick", description: "Defeated Shardbearer Godrick", tier: SILVER },
    { title: "Shardbearer Radahn", description: "Defeated Shardbearer Radahn", tier: SILVER },
    { title: "Shardbearer Morgott", description: "Defeated Shardbearer Morgott", tier: SILVER },
    { title: "Shardbearer Rykard", description: "Defeated Shardbearer Rykard", tier: SILVER },
    { title: "Shardbearer Malenia", description: "Defeated Shardbearer Malenia", tier: SILVER },
    { title: "Shardbearer Mohg", description: "Defeated Shardbearer Mohg", tier: SILVER },
    { title: "Maliketh the Black Blade", description: "Defeated Maliketh the Black Blade", tier: SILVER },
    { title: "Hoarah Loux, Warrior", description: "Defeated Hoarah Loux, Warrior", tier: SILVER },
    { title: "Dragonlord Placidusax", description: "Defeated Dragonlord Placidusax", tier: SILVER },
    { title: "God-Slaying Armament", description: "Upgraded any armament to its highest stage", tier: SILVER },
    { title: "Legendary Armaments", description: "Acquired all legendary armaments", tier: SILVER },
    { title: "Legendary Ashen Remains", description: "Acquired all legendary ashen remains", tier: SILVER },
    { title: "Legendary Sorceries and Incantations", description: "Acquired all legendary sorceries and incantations", tier: SILVER },
    { title: "Legendary Talismans", description: "Acquired all legendary talismans", tier: SILVER },
    { title: "Rennala, Queen of the Full Moon", description: "Defeated Rennala, Queen of the Full Moon", tier: BRONZE },
    { title: "Lichdragon Fortissax", description: "Defeated Lichdragon Fortissax", tier: BRONZE },
    { title: "Godskin Duo", description: "Defeated Godskin Duo", tier: BRONZE },
    { title: "Fire Giant", description: "Defeated Fire Giant", tier: BRONZE },
    { title: "Dragonkin Soldier of Nokstella", description: "Defeated Dragonkin Soldier of Nokstella", tier: BRONZE },
    { title: "Regal Ancestor Spirit", description: "Defeated Regal Ancestor Spirit", tier: BRONZE },
    { title: "Valiant Gargoyles", description: "Defeated Valiant Gargoyles", tier: BRONZE },
    { title: "Margit, the Fell Omen", description: "Defeated Margit, the Fell Omen", tier: BRONZE },
    { title: "Red Wolf of Radagon", description: "Defeated the Red Wolf of Radagon", tier: BRONZE },
    { title: "Godskin Noble", description: "Defeated Godskin Noble", tier: BRONZE },
    { title: "Magma Wyrm Makar", description: "Defeated Magma Wyrm Makar", tier: BRONZE },
    { title: "Godfrey, First Elden Lord", description: "Defeated Godfrey, First Elden Lord", tier: BRONZE },
    { title: "Mohg, the Omen", description: "Defeated Mohg, the Omen", tier: BRONZE },
    { title: "Mimic Tear", description: "Defeated Mimic Tear", tier: BRONZE },
    { title: "Loretta, Knight of the Haligtree", description: "Defeated Loretta, Knight of the Haligtree", tier: BRONZE },
    { title: "Astel, Naturalborn of the Void", description: "Defeated Astel, Naturalborn of the Void", tier: BRONZE },
    { title: "Leonine Misbegotten", description: "Defeated the Leonine Misbegotten", tier: BRONZE },
    { title: "Royal Knight Loretta", description: "Defeated Royal Knight Loretta", tier: BRONZE },
    { title: "Elemer of the Briar", description: "Defeated Elemer of the Briar", tier: BRONZE },
    { title: "Ancestor Spirit", description: "Defeated Ancestor Spirit", tier: BRONZE },
    { title: "Commander Niall", description: "Defeated Commander Niall", tier: BRONZE },
    { title: "Roundtable Hold", description: "Arrived at Roundtable Hold", tier: BRONZE },
    { title: "Great Rune", description: "Restored the power of a Great Rune", tier: BRONZE },
    { title: "Erdtree Aflame", description: "Used kindling to set the Erdtree aflame", tier: BRONZE },
  ],
};

const SETS = [BASE_SET];

function assertShape() {
  const count = (tier: AchievementTier) => BASE_SET.achievements.filter((a) => a.tier === tier).length;
  const shape = [PLATINUM, GOLD, SILVER, BRONZE].map(count).join("/");
  if (shape !== "1/3/14/24") throw new Error(`Expected 1/3/14/24 trophies by tier, got ${shape}`);
  const titles = new Set(BASE_SET.achievements.map((a) => a.title));
  if (titles.size !== 42) throw new Error(`Expected 42 distinct titles, got ${titles.size}`);
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
