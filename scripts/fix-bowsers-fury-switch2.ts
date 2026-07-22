/**
 * Remove the Bowser's Fury Game entry on switch-2.
 *
 * There is no Switch 2 release of Super Mario 3D World + Bowser's Fury —
 * the Switch version simply plays on Switch 2 via backward compatibility,
 * which does not create an ownable platform release. Refuses to delete if
 * any user data is attached.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Remove Bowser's Fury switch-2 entry ===\n");

  const game = await prisma.game.findFirst({
    where: {
      gameFamily: { title: { equals: "Bowser's Fury", mode: "insensitive" } },
      platform: { slug: "switch-2" },
    },
    include: {
      _count: {
        select: {
          trophies: true,
          userGames: true,
          collectionItems: true,
          buylistItems: true,
        },
      },
    },
  });

  if (!game) {
    console.log("No switch-2 Bowser's Fury game found — nothing to do");
    return;
  }

  const { trophies, userGames, collectionItems, buylistItems } = game._count;
  if (trophies + userGames + collectionItems + buylistItems > 0) {
    console.error("Game has user data attached, refusing to delete:", game._count);
    return;
  }

  await prisma.game.delete({ where: { id: game.id } });
  console.log(`Deleted game ${game.id} (Bowser's Fury on switch-2)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
