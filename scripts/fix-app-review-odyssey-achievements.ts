/**
 * Tick the Super Mario Odyssey completionist set for the App Store review
 * demo account.
 *
 * The demo account was awarded an Odyssey trophy in August 2026, back when the
 * family had no achievement sets at all. Adding the 46-achievement set left it
 * holding a trophy with 0/46 ticked, which reads as a bug to anyone reviewing
 * the app. This fills in the set so the demo account is self-consistent.
 *
 * Only adds UserAchievement rows, and only for the demo account.
 */

import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile?.();
} catch {
  // Ignore missing env file in deployed environments.
}

const prisma = new PrismaClient();

const DEMO_EMAIL = "appreview@trophyrooms.org";
const FAMILY_TITLE = "Super Mario Odyssey";

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: DEMO_EMAIL },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    throw new Error(`Demo account not found: ${DEMO_EMAIL}`);
  }

  const achievements = await prisma.achievement.findMany({
    where: { achievementSet: { gameFamily: { title: FAMILY_TITLE } } },
    select: { id: true, title: true },
  });

  if (achievements.length === 0) {
    throw new Error(`No achievements found for ${FAMILY_TITLE}`);
  }

  const result = await prisma.userAchievement.createMany({
    data: achievements.map((achievement) => ({
      userId: user.id,
      achievementId: achievement.id,
    })),
    skipDuplicates: true,
  });

  const ticked = await prisma.userAchievement.count({
    where: {
      userId: user.id,
      achievement: { achievementSet: { gameFamily: { title: FAMILY_TITLE } } },
    },
  });

  console.log(
    `${user.name ?? user.email}: added ${result.count}, now ${ticked}/${achievements.length} ${FAMILY_TITLE} achievements`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
