/**
 * The Switch 2 releases of RE7 and Village ship as the Gold Edition SKU,
 * so those Game rows carry the Gold Edition box art as their platform
 * cover override (the shared "Gold Edition" version cannot hold art - it
 * spans four families). The version rows and collection items inherit it
 * through the cover fallback chain.
 */

import { PrismaClient } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

const TARGETS = [
  {
    familyTitle: "Resident Evil 7: Biohazard",
    platformSlug: "switch-2",
    igdbSlugs: ["resident-evil-7-biohazard-gold-edition"],
  },
  {
    familyTitle: "Resident Evil Village",
    platformSlug: "switch-2",
    igdbSlugs: ["resident-evil-village-gold-edition"],
  },
];

async function main() {
  for (const target of TARGETS) {
    const game = await prisma.game.findFirst({
      where: {
        gameFamily: { title: { equals: target.familyTitle, mode: "insensitive" } },
        platform: { slug: target.platformSlug },
      },
    });
    if (!game) {
      console.log(`${target.familyTitle} ${target.platformSlug}: game not found`);
      continue;
    }
    if (game.coverUrl) {
      console.log(`${target.familyTitle}: already has a platform cover`);
      continue;
    }
    let cover: string | null = null;
    for (const slug of target.igdbSlugs) {
      try {
        const [igdb] = await igdbRequest<IGDBGame[]>(
          "games",
          `fields id, name, slug, cover.image_id; where slug = "${slug}"; limit 1;`
        );
        if (igdb?.cover?.image_id) {
          cover = getCoverUrl(igdb.cover.image_id, "cover_big");
          console.log(`${target.familyTitle}: matched ${igdb.slug}`);
          break;
        }
      } catch {
        // try next slug
      }
    }
    if (!cover) {
      console.log(`${target.familyTitle}: no Gold Edition art on IGDB`);
      continue;
    }
    await prisma.game.update({ where: { id: game.id }, data: { coverUrl: cover } });
    console.log(`${target.familyTitle} ${target.platformSlug}: Gold Edition cover set`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
