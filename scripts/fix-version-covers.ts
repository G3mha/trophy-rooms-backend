/**
 * Backfill covers for game versions where IGDB has a distinct edition
 * entry. Only single-game versions are eligible: shared versions (GOTY,
 * Remastered, Director's Cut, ...) must keep a null cover so clients fall
 * back to the current game's art rather than another game's.
 */

import { PrismaClient } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

const COVERS: Array<{ versionSlug: string; igdbSlugs: string[] }> = [
  { versionSlug: "restless-dreams", igdbSlugs: ["silent-hill-2-restless-dreams"] },
  { versionSlug: "fes", igdbSlugs: ["shin-megami-tensei-persona-3-fes", "persona-3-fes"] },
  { versionSlug: "dx", igdbSlugs: ["the-legend-of-zelda-links-awakening-dx"] },
  {
    versionSlug: "anniversary-edition",
    igdbSlugs: [
      "teenage-mutant-ninja-turtles-shredders-revenge-anniversary-edition",
      "tmnt-shredders-revenge-anniversary-edition",
    ],
  },
];

async function main() {
  for (const entry of COVERS) {
    const version = await prisma.gameVersion.findUnique({
      where: { slug: entry.versionSlug },
    });
    if (!version) {
      console.log(`${entry.versionSlug}: version not found`);
      continue;
    }
    if (version.coverUrl) {
      console.log(`${entry.versionSlug}: already has cover`);
      continue;
    }
    let found: IGDBGame | null = null;
    for (const slug of entry.igdbSlugs) {
      try {
        const [game] = await igdbRequest<IGDBGame[]>(
          "games",
          `fields id, name, slug, cover.image_id;
           where slug = "${slug}"; limit 1;`
        );
        if (game?.cover?.image_id) {
          found = game;
          break;
        }
      } catch {
        // try next slug
      }
    }
    if (!found?.cover?.image_id) {
      console.log(`${entry.versionSlug}: no IGDB edition art found`);
      continue;
    }
    await prisma.gameVersion.update({
      where: { id: version.id },
      data: { coverUrl: getCoverUrl(found.cover.image_id, "cover_big") },
    });
    console.log(`${entry.versionSlug}: cover set (${found.slug})`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
