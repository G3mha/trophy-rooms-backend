/**
 * Shared GameVersions (linked to games from more than one family) must not
 * carry a coverUrl: a single image cannot represent "Gold Edition" for both
 * RE7 and Village, and version-first display logic paints the wrong art on
 * every other game. Null the cover on any multi-family version; per-SKU art
 * belongs on the Game's platform cover override instead.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const versions = await prisma.gameVersion.findMany({
    where: { coverUrl: { not: null } },
    include: { games: { select: { gameFamilyId: true } } },
  });

  for (const version of versions) {
    const families = new Set(
      version.games.map((g) => g.gameFamilyId).filter((id): id is string => Boolean(id))
    );
    if (families.size > 1) {
      await prisma.gameVersion.update({
        where: { id: version.id },
        data: { coverUrl: null },
      });
      console.log(`cleared: ${version.name} (${version.slug}) - spans ${families.size} families`);
    } else {
      console.log(`kept: ${version.name} (${version.slug}) - single family`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
