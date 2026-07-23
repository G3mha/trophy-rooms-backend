/**
 * Merge the duplicate DKC 2/3 GBA-port families into the canonical
 * families without touching user data: the duplicate's game row (which
 * holds collection items) is re-parented onto the canonical family, the
 * empty just-created gba row is dropped, and the emptied duplicate family
 * is deleted. Also repairs IGDB covers for the two Donkey Kong families
 * where an exact-name lookup missed.
 */

import { PrismaClient } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

const MERGES = [
  {
    dupTitle: "Donkey Kong Country 2",
    canonicalTitle: "Donkey Kong Country 2: Diddy's Kong Quest",
    naDate: "2004-11-15",
  },
  {
    dupTitle: "Donkey Kong Country 3",
    canonicalTitle: "Donkey Kong Country 3: Dixie Kong's Double Trouble!",
    naDate: "2005-11-07",
  },
];

async function main() {
  for (const merge of MERGES) {
    const dup = await prisma.gameFamily.findFirst({
      where: { title: { equals: merge.dupTitle, mode: "insensitive" } },
      include: { games: { include: { platform: true } } },
    });
    const canonical = await prisma.gameFamily.findFirst({
      where: { title: { equals: merge.canonicalTitle, mode: "insensitive" } },
      include: { games: { include: { platform: true } } },
    });
    if (!dup || !canonical) {
      console.log(`${merge.dupTitle}: nothing to merge`);
      continue;
    }

    const dupGba = dup.games.find((g) => g.platform?.slug === "gba");
    const emptyGba = canonical.games.find((g) => g.platform?.slug === "gba");

    // Drop the empty placeholder created by the series pass so the unique
    // (family, platform) slot is free for the user's row
    if (emptyGba) {
      const counts = await prisma.game.findUnique({
        where: { id: emptyGba.id },
        include: {
          _count: { select: { userGames: true, collectionItems: true, trophies: true, buylistItems: true } },
        },
      });
      const c = counts?._count;
      if (c && c.userGames + c.collectionItems + c.trophies + c.buylistItems === 0) {
        await prisma.game.delete({ where: { id: emptyGba.id } });
        console.log(`${merge.canonicalTitle}: empty gba placeholder removed`);
      }
    }

    if (dupGba) {
      await prisma.game.update({
        where: { id: dupGba.id },
        data: { gameFamilyId: canonical.id, releaseDate: new Date(merge.naDate) },
      });
      console.log(`${merge.dupTitle} gba: re-parented to canonical with NA date`);
    }

    // Move any family-level buylist references, then delete the empty shell
    await prisma.buylistItem.updateMany({
      where: { gameFamilyId: dup.id },
      data: { gameFamilyId: canonical.id },
    });
    const remaining = await prisma.game.count({ where: { gameFamilyId: dup.id } });
    if (remaining === 0) {
      await prisma.gameFamily.delete({ where: { id: dup.id } });
      console.log(`${merge.dupTitle}: duplicate family deleted`);
    } else {
      console.log(`${merge.dupTitle}: still has ${remaining} games, kept`);
    }
  }

  // Cover repairs via exact name + release-year window (search ranking can
  // bury a 1981 arcade game under dozens of same-named entries)
  for (const repair of [
    { title: "Donkey Kong", year: 1981 },
    { title: "Donkey Kong (1994)", igdbName: "Donkey Kong", year: 1994 },
  ]) {
    const family = await prisma.gameFamily.findFirst({
      where: { title: { equals: repair.title, mode: "insensitive" } },
    });
    if (!family || family.coverUrl) continue;
    const from = Math.floor(new Date(`${repair.year}-01-01`).getTime() / 1000);
    const to = Math.floor(new Date(`${repair.year + 1}-01-01`).getTime() / 1000);
    const results = await igdbRequest<IGDBGame[]>(
      "games",
      `fields id, name, slug, summary, cover.image_id, first_release_date;
       where name = "${repair.igdbName ?? repair.title}"
         & first_release_date >= ${from} & first_release_date < ${to};
       limit 5;`
    );
    const match = results[0] ?? null;
    if (match?.cover?.image_id) {
      await prisma.gameFamily.update({
        where: { id: family.id },
        data: {
          coverUrl: getCoverUrl(match.cover.image_id, "cover_big"),
          description: family.description ?? match.summary ?? null,
        },
      });
      console.log(`${repair.title}: cover repaired (${match.slug})`);
    } else {
      console.log(`${repair.title}: no IGDB match found`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
