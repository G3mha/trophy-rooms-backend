/**
 * Check that Platinums and trophies match what players have ticked. Read-only.
 *
 * Uses the rules in src/lib/trophies.ts: a player is finished when they have
 * every non-Platinum trophy in every list that counts for the game
 * (trophyEligibleSetWhere), and a finished player holds a Trophy row on at
 * least one edition plus the Platinum of each counting list.
 *
 * Reports:
 *   a. counting lists with no Platinum or more than one
 *   b. finished players missing the Trophy row or a Platinum
 *   c. players holding a Trophy row or a Platinum without being finished
 *
 * Left out of (c) on purpose, because the code never touches them: trophies
 * on games with nothing to tick in a counting list (awardTrophyIfComplete and
 * unmarkAchievementComplete both stop at zero), and Platinums in lists that
 * don't count (private custom lists, countsTowardTrophy cleared).
 *
 *   npx tsx scripts/check-platinum-backfill.ts
 */

import { AchievementTier } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import { trophyEligibleSetWhere } from "../src/lib/trophies.js";

type Family = {
  title: string;
  required: Set<string>;
  platinums: Array<{ id: string; list: string }>;
};

async function main() {
  const sets = await prisma.achievementSet.findMany({
    where: { gameFamilyId: { not: null }, ...trophyEligibleSetWhere },
    select: {
      title: true,
      gameFamily: { select: { id: true, title: true } },
      achievements: { select: { id: true, tier: true } },
    },
    orderBy: [{ gameFamily: { title: "asc" } }, { title: "asc" }],
  });

  const families = new Map<string, Family>();
  const familyOfAchievement = new Map<string, string>();
  const badLists: string[] = [];
  for (const set of sets) {
    if (!set.gameFamily) continue;
    const family = families.get(set.gameFamily.id) ?? {
      title: set.gameFamily.title,
      required: new Set<string>(),
      platinums: [],
    };
    families.set(set.gameFamily.id, family);

    let platinums = 0;
    for (const achievement of set.achievements) {
      familyOfAchievement.set(achievement.id, set.gameFamily.id);
      if (achievement.tier === AchievementTier.PLATINUM) {
        platinums++;
        family.platinums.push({ id: achievement.id, list: set.title });
      } else {
        family.required.add(achievement.id);
      }
    }
    if (platinums !== 1) {
      badLists.push(`${set.gameFamily.title} / ${set.title}: ${platinums} Platinums, ${set.achievements.length} trophies`);
    }
  }

  // familyId -> userId -> ticked achievement ids
  const ticks = new Map<string, Map<string, Set<string>>>();
  const userAchievements = await prisma.userAchievement.findMany({
    where: { achievementId: { in: [...familyOfAchievement.keys()] } },
    select: { userId: true, achievementId: true },
  });
  for (const row of userAchievements) {
    const familyId = familyOfAchievement.get(row.achievementId)!;
    const byUser = ticks.get(familyId) ?? new Map<string, Set<string>>();
    ticks.set(familyId, byUser);
    const ticked = byUser.get(row.userId) ?? new Set<string>();
    byUser.set(row.userId, ticked);
    ticked.add(row.achievementId);
  }

  // familyId -> users with a Trophy row on any edition
  const trophyHolders = new Map<string, Set<string>>();
  const trophies = await prisma.trophy.findMany({
    select: { userId: true, game: { select: { gameFamilyId: true } } },
  });
  let trophiesWithoutList = 0;
  for (const trophy of trophies) {
    const familyId = trophy.game.gameFamilyId;
    if (!familyId || !families.get(familyId)?.required.size) {
      trophiesWithoutList++;
      continue;
    }
    const holders = trophyHolders.get(familyId) ?? new Set<string>();
    trophyHolders.set(familyId, holders);
    holders.add(trophy.userId);
  }

  const missing: string[] = [];
  const unearned: string[] = [];
  let finished = 0;
  for (const [familyId, family] of families) {
    if (family.required.size === 0) continue;
    const byUser = ticks.get(familyId) ?? new Map<string, Set<string>>();
    const holders = trophyHolders.get(familyId) ?? new Set<string>();

    for (const userId of new Set([...byUser.keys(), ...holders])) {
      const ticked = byUser.get(userId) ?? new Set<string>();
      const done = [...family.required].filter((id) => ticked.has(id)).length;
      const complete = done === family.required.size;
      if (complete) finished++;

      const progress = `${done}/${family.required.size}`;
      if (complete && !holders.has(userId)) missing.push(`${family.title}: user ${userId} has no Trophy row`);
      if (!complete && holders.has(userId)) {
        unearned.push(`${family.title}: user ${userId} has a Trophy row at ${progress}`);
      }
      for (const platinum of family.platinums) {
        const held = ticked.has(platinum.id);
        if (complete && !held) missing.push(`${family.title} / ${platinum.list}: user ${userId} has no Platinum`);
        if (!complete && held) {
          unearned.push(`${family.title} / ${platinum.list}: user ${userId} has the Platinum at ${progress}`);
        }
      }
    }
  }

  const report = (label: string, rows: string[]) => {
    console.log(`\n${label}: ${rows.length}`);
    for (const row of rows) console.log(`  ${row}`);
  };
  console.log(`${sets.length} counting lists in ${families.size} games, ${finished} finished player/game pairs.`);
  report("a. Lists without exactly one Platinum", badLists);
  report("b. Finished but missing the Trophy row or Platinum", missing);
  report("c. Trophy row or Platinum without being finished", unearned);
  console.log(`\nSkipped: ${trophiesWithoutList} trophies on games with nothing to tick in a counting list.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
