/**
 * Give the Link's Awakening Switch remake its own identity: the 2019 box
 * art as the explicit platform cover (the family keeps the Game Boy
 * original's art per the rules), and the shared "Remake" version instead
 * of Standard - consistent with TTYD and Mario vs. Donkey Kong. The
 * owner's collection item referencing Standard is relabeled to Remake so
 * it stays consistent with the game's version list.
 */

import { PrismaClient } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Fix Link's Awakening Switch entry ===\n");

  const game = await prisma.game.findFirst({
    where: {
      gameFamily: { title: { equals: "The Legend of Zelda: Link's Awakening", mode: "insensitive" } },
      platform: { slug: "switch" },
    },
    include: { versions: { select: { id: true, slug: true } } },
  });
  if (!game) {
    console.error("Switch game not found");
    return;
  }

  // 2019 remake cover from IGDB (exact name + year window)
  const from = Math.floor(new Date("2019-01-01").getTime() / 1000);
  const to = Math.floor(new Date("2020-01-01").getTime() / 1000);
  const results = await igdbRequest<IGDBGame[]>(
    "games",
    `fields id, name, slug, cover.image_id, first_release_date;
     where name = "The Legend of Zelda: Link's Awakening"
       & first_release_date >= ${from} & first_release_date < ${to};
     limit 5;`
  );
  const remakeIgdb = results[0] ?? null;
  console.log("IGDB remake:", remakeIgdb?.slug ?? "not found");

  if (remakeIgdb?.cover?.image_id && !game.coverUrl) {
    await prisma.game.update({
      where: { id: game.id },
      data: { coverUrl: getCoverUrl(remakeIgdb.cover.image_id, "cover_big") },
    });
    console.log("Switch cover set to the 2019 remake box art");
  }

  const remake = await prisma.gameVersion.findUnique({ where: { slug: "remake" } });
  const standard = await prisma.gameVersion.findUnique({ where: { slug: "standard" } });
  if (!remake || !standard) {
    console.error("Remake or Standard version missing");
    return;
  }

  if (!game.versions.some((v) => v.id === remake.id)) {
    await prisma.game.update({
      where: { id: game.id },
      data: {
        versions: {
          connect: [{ id: remake.id }],
          disconnect: [{ id: standard.id }],
        },
      },
    });
    await prisma.gameVersionReleaseDate.upsert({
      where: { gameId_gameVersionId: { gameId: game.id, gameVersionId: remake.id } },
      update: { releaseDate: new Date("2019-09-20") },
      create: { gameId: game.id, gameVersionId: remake.id, releaseDate: new Date("2019-09-20") },
    });
    console.log("Version swapped: Standard -> Remake (2019-09-20)");
  }

  // Relabel collection/library rows that referenced Standard on this game
  const itemUpdates = await prisma.collectionItem.updateMany({
    where: { gameId: game.id, gameVersionId: standard.id },
    data: { gameVersionId: remake.id },
  });
  const userGameUpdates = await prisma.userGame.updateMany({
    where: { gameId: game.id, gameVersionId: standard.id },
    data: { gameVersionId: remake.id },
  });
  console.log(
    `Relabeled ${itemUpdates.count} collection item(s), ${userGameUpdates.count} library entr(ies)`
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
