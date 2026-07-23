/**
 * Split multi-family edition versions into per-family rows (2026-07-23).
 *
 * A shared "Gold Edition" / "Director's Cut" / "Cloud Version" / "Deluxe"
 * row cannot carry edition art or accurate dates for every family it spans.
 * Each family gets its own version row (same display name, family-suffixed
 * slug) with its own IGDB edition cover where available. All references
 * (game links, per-platform date overrides, collection items, library
 * entries, buylist items) migrate to the per-family rows, then the shared
 * row is deleted. Also sets art on single-family versions that lacked it.
 */

import { PrismaClient } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

async function igdbCover(slugs: string[]): Promise<string | null> {
  for (const slug of slugs) {
    try {
      const [igdb] = await igdbRequest<IGDBGame[]>(
        "games",
        `fields id, slug, cover.image_id; where slug = "${slug}"; limit 1;`
      );
      if (igdb?.cover?.image_id) {
        return getCoverUrl(igdb.cover.image_id, "cover_big");
      }
    } catch {
      // try next
    }
  }
  return null;
}

// IGDB edition-art slugs per (shared version, family slug)
const ART: Record<string, Record<string, string[]>> = {
  "gold-edition": {
    "resident-evil-7-biohazard": ["resident-evil-7-biohazard-gold-edition"],
    "resident-evil-village": ["resident-evil-village-gold-edition"],
    "resident-evil-5": ["resident-evil-5-gold-edition"],
    "resident-evil-4-2023": ["resident-evil-4-gold-edition", "resident-evil-4-remake-gold-edition"],
  },
  "directors-cut": {
    "resident-evil": ["resident-evil-directors-cut"],
    "ghost-of-tsushima": ["ghost-of-tsushima-directors-cut"],
    "yakuza-0": ["yakuza-0-directors-cut"],
    "death-stranding": ["death-stranding-directors-cut"],
  },
  "cloud-version": {
    "resident-evil-7-biohazard": ["resident-evil-7-biohazard-cloud"],
    "resident-evil-village": ["resident-evil-village-cloud"],
    "resident-evil-2-2019": ["resident-evil-2-cloud"],
    "resident-evil-3-2020": ["resident-evil-3-cloud"],
  },
  "deluxe": {
    "new-super-mario-bros-u": ["new-super-mario-bros-u-deluxe"],
    "mario-kart-8": ["mario-kart-8-deluxe"],
    "pikmin-3": ["pikmin-3-deluxe"],
    "kirbys-return-to-dream-land": ["kirby-s-return-to-dream-land-deluxe", "kirbys-return-to-dream-land-deluxe"],
  },
};

async function splitVersion(sharedSlug: string) {
  const shared = await prisma.gameVersion.findUnique({
    where: { slug: sharedSlug },
    include: {
      games: { include: { gameFamily: { select: { id: true, slug: true, title: true } } } },
      versionReleaseDates: true,
    },
  });
  if (!shared) {
    console.log(`${sharedSlug}: not found (already split?)`);
    return;
  }

  const byFamily = new Map<string, { slug: string; title: string; games: typeof shared.games }>();
  for (const game of shared.games) {
    if (!game.gameFamily) continue;
    const entry = byFamily.get(game.gameFamily.id) ?? {
      slug: game.gameFamily.slug,
      title: game.gameFamily.title,
      games: [],
    };
    entry.games.push(game);
    byFamily.set(game.gameFamily.id, entry);
  }

  if (byFamily.size <= 1) {
    console.log(`${sharedSlug}: single family, no split needed`);
    return;
  }
  console.log(`\n${sharedSlug}: splitting across ${byFamily.size} families`);

  for (const [, family] of byFamily) {
    const newSlug = `${sharedSlug}-${family.slug}`;
    let version = await prisma.gameVersion.findUnique({ where: { slug: newSlug } });
    if (!version) {
      const cover = await igdbCover(ART[sharedSlug]?.[family.slug] ?? []);
      version = await prisma.gameVersion.create({
        data: {
          name: shared.name,
          slug: newSlug,
          description: shared.description,
          coverUrl: cover,
          releaseDate: shared.releaseDate,
          isDefault: false,
          digitalOnly: shared.digitalOnly,
        },
      });
      console.log(`  ${family.title}: created ${newSlug}${cover ? " (with art)" : ""}`);
    }

    const gameIds = family.games.map((g) => g.id);
    for (const gameId of gameIds) {
      await prisma.game.update({
        where: { id: gameId },
        data: {
          versions: { connect: [{ id: version.id }], disconnect: [{ id: shared.id }] },
        },
      });
    }

    // Per-platform date overrides
    for (const override of shared.versionReleaseDates.filter((o) => gameIds.includes(o.gameId))) {
      await prisma.gameVersionReleaseDate.upsert({
        where: { gameId_gameVersionId: { gameId: override.gameId, gameVersionId: version.id } },
        update: { releaseDate: override.releaseDate },
        create: { gameId: override.gameId, gameVersionId: version.id, releaseDate: override.releaseDate },
      });
    }

    // User references follow their family's new version
    const items = await prisma.collectionItem.updateMany({
      where: { gameVersionId: shared.id, gameId: { in: gameIds } },
      data: { gameVersionId: version.id },
    });
    const userGames = await prisma.userGame.updateMany({
      where: { gameVersionId: shared.id, gameId: { in: gameIds } },
      data: { gameVersionId: version.id },
    });
    const buylist = await prisma.buylistItem.updateMany({
      where: { gameVersionId: shared.id, gameId: { in: gameIds } },
      data: { gameVersionId: version.id },
    });
    if (items.count + userGames.count + buylist.count > 0) {
      console.log(`  ${family.title}: migrated ${items.count} collection, ${userGames.count} library, ${buylist.count} buylist refs`);
    }
  }

  await prisma.gameVersionReleaseDate.deleteMany({ where: { gameVersionId: shared.id } });
  const remainingGames = await prisma.game.count({ where: { versions: { some: { id: shared.id } } } });
  const remainingRefs = await prisma.collectionItem.count({ where: { gameVersionId: shared.id } });
  if (remainingGames === 0 && remainingRefs === 0) {
    await prisma.gameVersion.delete({ where: { id: shared.id } });
    console.log(`  shared ${sharedSlug} row deleted`);
  } else {
    console.log(`  shared ${sharedSlug} kept: ${remainingGames} games, ${remainingRefs} refs remain`);
  }
}

async function main() {
  console.log("=== Split shared edition versions ===");

  for (const slug of ["gold-edition", "directors-cut", "cloud-version", "deluxe"]) {
    await splitVersion(slug);
  }

  // Single-family versions that lacked art
  console.log("");
  for (const single of [
    { slug: "inferno", igdbSlugs: ["alone-in-the-dark-inferno"] },
  ]) {
    const version = await prisma.gameVersion.findUnique({ where: { slug: single.slug } });
    if (version && !version.coverUrl) {
      const cover = await igdbCover(single.igdbSlugs);
      if (cover) {
        await prisma.gameVersion.update({ where: { id: version.id }, data: { coverUrl: cover } });
        console.log(`${single.slug}: art set`);
      } else {
        console.log(`${single.slug}: no IGDB art found`);
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
