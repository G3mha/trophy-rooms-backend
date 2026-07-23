/**
 * Metal Slug Tactics was seeded with only the PS5 entry. It launched
 * 2024-11-05 on Switch, PS4, PS5, Xbox One, Xbox Series, and PC - add
 * the missing platform entries.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const family = await prisma.gameFamily.findFirst({
    where: { title: { equals: "Metal Slug Tactics", mode: "insensitive" } },
    include: { games: { include: { platform: true } } },
  });
  if (!family) {
    console.error("Family not found");
    return;
  }
  const standard = await prisma.gameVersion.findUnique({ where: { slug: "standard" } });

  for (const slug of ["switch", "ps4", "xbox-one", "xbox-series", "steam"]) {
    if (family.games.some((g) => g.platform?.slug === slug)) {
      console.log(`${slug}: already exists`);
      continue;
    }
    const platform = await prisma.platform.findUnique({ where: { slug } });
    if (!platform) continue;
    await prisma.game.create({
      data: {
        gameFamilyId: family.id,
        platformId: platform.id,
        releaseDate: new Date("2024-11-05"),
        ...(standard ? { versions: { connect: [{ id: standard.id }] } } : {}),
      },
    });
    console.log(`${slug}: created`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
