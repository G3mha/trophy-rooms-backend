/**
 * Fix Live A Live remake covers and description: the import's year-based
 * IGDB search matched "Pokemon Trading Card Game Live" for 2022. Re-fetch
 * with an exact name match and repair the modern platform games.
 */

import { PrismaClient } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

async function main() {
  const results = await igdbRequest<IGDBGame[]>(
    "games",
    `fields id, name, slug, summary, cover.image_id, first_release_date;
     where name = "Live A Live"; limit 10;`
  );
  for (const g of results) {
    console.log(
      `- ${g.slug} (${g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().split("T")[0] : "n/a"})`
    );
  }

  const remake = results.find(
    (g) => g.first_release_date && new Date(g.first_release_date * 1000).getFullYear() === 2022
  );
  const original = results.find(
    (g) => g.first_release_date && new Date(g.first_release_date * 1000).getFullYear() === 1994
  );
  if (!remake) {
    console.error("Remake not found on IGDB");
    return;
  }

  const remakeCover = remake.cover?.image_id
    ? getCoverUrl(remake.cover.image_id, "cover_big")
    : null;

  const family = await prisma.gameFamily.findFirst({
    where: { slug: "live-a-live" },
    include: { games: { include: { platform: true } } },
  });
  if (!family) {
    console.error("Family not found");
    return;
  }

  await prisma.gameFamily.update({
    where: { id: family.id },
    data: { description: remake.summary || original?.summary || null },
  });
  console.log("Family description fixed");

  for (const game of family.games) {
    if (["switch", "ps4", "ps5"].includes(game.platform?.slug ?? "")) {
      await prisma.game.update({
        where: { id: game.id },
        data: { coverUrl: remakeCover },
      });
      console.log(`${game.platform?.slug}: remake cover fixed`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
