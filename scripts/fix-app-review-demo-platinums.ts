/**
 * Make the App Review demo account's Platinums real.
 *
 * seed-demo-account.ts gave the account Platinums for Elden Ring and God of
 * War: Chains of Olympus in August 2026, when neither game had a trophy list.
 * Now that both do, the account held two Platinums with nothing ticked. This
 * ticks every trophy that counts toward each one and then runs the same award
 * the app runs, which ticks the Platinum itself.
 *
 * New ticks are dated to the Platinum the account already holds, so the
 * activity feed doesn't show 68 trophies earned today.
 *
 * Only adds rows, and only for the demo account.
 *
 *   npx tsx scripts/fix-app-review-demo-platinums.ts          # dry run
 *   npx tsx scripts/fix-app-review-demo-platinums.ts --apply
 */

import { PrismaClient } from "@prisma/client";
import { awardTrophyIfComplete, notPlatinum, trophyEligibleSetWhere } from "../src/lib/trophies.js";

try {
  process.loadEnvFile?.();
} catch {
  // Ignore missing env file in deployed environments.
}

const prisma = new PrismaClient();

const DEMO_EMAIL = "appreview@trophyrooms.org";
const FAMILY_SLUGS = ["elden-ring", "god-of-war-chains-of-olympus"];

async function main() {
  const apply = process.argv.includes("--apply");

  const user = await prisma.user.findFirst({ where: { email: DEMO_EMAIL }, select: { id: true, name: true } });
  if (!user) throw new Error(`Demo account not found: ${DEMO_EMAIL}`);

  for (const slug of FAMILY_SLUGS) {
    const family = await prisma.gameFamily.findFirst({ where: { slug }, select: { id: true, title: true } });
    if (!family) throw new Error(`No family with slug ${slug}`);

    const held = await prisma.trophy.findFirst({
      where: { userId: user.id, game: { gameFamilyId: family.id } },
      select: { createdAt: true },
    });
    if (!held) {
      console.log(`SKIP  ${family.title}: the demo account holds no Platinum for it`);
      continue;
    }

    const inFamily = { achievementSet: { gameFamilyId: family.id, ...trophyEligibleSetWhere } };
    const trophies = await prisma.achievement.findMany({ where: { ...notPlatinum, ...inFamily }, select: { id: true } });
    if (trophies.length === 0) throw new Error(`${family.title} has no trophy list`);

    const before = await prisma.userAchievement.findMany({
      where: { userId: user.id, achievement: inFamily },
      select: { id: true },
    });
    console.log(`${apply ? "DONE" : "PLAN"}  ${family.title}: tick ${trophies.length} trophies and the Platinum`);
    if (!apply) continue;

    await prisma.userAchievement.createMany({
      data: trophies.map((trophy) => ({ userId: user.id, achievementId: trophy.id })),
      skipDuplicates: true,
    });
    await awardTrophyIfComplete(prisma, user.id, family.id);
    await prisma.userAchievement.updateMany({
      where: { userId: user.id, achievement: inFamily, id: { notIn: before.map((row) => row.id) } },
      data: { createdAt: held.createdAt },
    });

    const ticked = await prisma.userAchievement.count({ where: { userId: user.id, achievement: inFamily } });
    console.log(`      ${user.name}: ${ticked} of ${trophies.length + 1} ticked`);
  }

  if (!apply) console.log("Dry run. Pass --apply to write.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
