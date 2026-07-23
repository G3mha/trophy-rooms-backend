/**
 * Remove never-released Resident Evil entries:
 * - Resident Evil Portable (PSP, announced 2009, vaporware)
 * - Resident Evil 1.5 (the cancelled RE2 prototype, never released)
 * - The cancelled GBA port row on Resident Evil 2
 *
 * Refuses to delete anything with user data attached.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function removeFamily(title: string) {
  const family = await prisma.gameFamily.findFirst({
    where: { title: { equals: title, mode: "insensitive" } },
    include: {
      games: {
        include: {
          _count: {
            select: { userGames: true, collectionItems: true, trophies: true, buylistItems: true },
          },
        },
      },
      _count: { select: { buylistItems: true } },
    },
  });
  if (!family) {
    console.log(`${title}: not found`);
    return;
  }
  const gameData = family.games.reduce(
    (sum, g) =>
      sum + g._count.userGames + g._count.collectionItems + g._count.trophies + g._count.buylistItems,
    0
  );
  if (gameData + family._count.buylistItems > 0) {
    console.error(`${title}: has user data attached, refusing to delete`);
    return;
  }
  await prisma.gameFamily.delete({ where: { id: family.id } });
  console.log(`${title}: deleted (${family.games.length} game rows cascaded)`);
}

async function main() {
  console.log("=== Remove never-released RE entries ===\n");

  await removeFamily("Resident Evil Portable");
  await removeFamily("Resident Evil 1.5");

  // Cancelled GBA port of Resident Evil 2
  const gbaPort = await prisma.game.findFirst({
    where: {
      gameFamily: { title: { equals: "Resident Evil 2", mode: "insensitive" } },
      platform: { slug: "gba" },
    },
    include: {
      _count: {
        select: { userGames: true, collectionItems: true, trophies: true, buylistItems: true },
      },
    },
  });
  if (!gbaPort) {
    console.log("RE2 gba: not found");
    return;
  }
  const { userGames, collectionItems, trophies, buylistItems } = gbaPort._count;
  if (userGames + collectionItems + trophies + buylistItems > 0) {
    console.error("RE2 gba: has user data attached, refusing to delete");
    return;
  }
  await prisma.game.delete({ where: { id: gbaPort.id } });
  console.log("RE2 gba: deleted (cancelled port)");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
