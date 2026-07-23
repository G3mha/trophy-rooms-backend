/**
 * Import Live A Live: the 1994 Super Famicom original (Japan-only) plus the
 * 2022 HD-2D remake (Switch 2022-07-22, PS4/PS5 2023-04-27), modeled as one
 * family with an "HD-2D Remake" version on the modern platforms.
 */

import { PrismaClient } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Import Live A Live ===\n");

  const existing = await prisma.gameFamily.findFirst({
    where: { title: { equals: "Live A Live", mode: "insensitive" } },
  });
  if (existing) {
    console.log("Family already exists");
    return;
  }

  // Exact name match: a loose search matches "Pokemon Trading Card Game Live"
  const results = await igdbRequest<IGDBGame[]>(
    "games",
    `fields id, name, slug, summary, cover.image_id, first_release_date;
     where name = "Live A Live"; limit 10;`
  );
  const original = results.find(
    (g) => g.first_release_date && new Date(g.first_release_date * 1000).getFullYear() === 1994
  );
  const remake = results.find(
    (g) => g.first_release_date && new Date(g.first_release_date * 1000).getFullYear() === 2022
  );
  console.log("IGDB original:", original?.slug ?? "not found");
  console.log("IGDB remake:", remake?.slug ?? "not found");

  const familyCover = original?.cover?.image_id
    ? getCoverUrl(original.cover.image_id, "cover_big")
    : remake?.cover?.image_id
      ? getCoverUrl(remake.cover.image_id, "cover_big")
      : null;
  const remakeCover = remake?.cover?.image_id
    ? getCoverUrl(remake.cover.image_id, "cover_big")
    : null;

  const family = await prisma.gameFamily.create({
    data: {
      title: "Live A Live",
      slug: "live-a-live",
      description: remake?.summary || original?.summary || null,
      coverUrl: familyCover,
      releaseDate: new Date("1994-09-02"),
    },
  });
  console.log(`Created family: ${family.id}`);

  const standard = await prisma.gameVersion.findUnique({ where: { slug: "standard" } });
  let hd2d = await prisma.gameVersion.findUnique({ where: { slug: "hd-2d-remake" } });
  if (!hd2d) {
    hd2d = await prisma.gameVersion.create({
      data: { name: "HD-2D Remake", slug: "hd-2d-remake", isDefault: false },
    });
    console.log("Created version: HD-2D Remake");
  }

  const entries: Array<{ slug: string; date: string; versionId?: string; coverUrl?: string | null }> = [
    { slug: "snes", date: "1994-09-02", versionId: standard?.id },
    { slug: "switch", date: "2022-07-22", versionId: hd2d.id, coverUrl: remakeCover },
    { slug: "ps4", date: "2023-04-27", versionId: hd2d.id, coverUrl: remakeCover },
    { slug: "ps5", date: "2023-04-27", versionId: hd2d.id, coverUrl: remakeCover },
  ];

  for (const entry of entries) {
    const platform = await prisma.platform.findUnique({ where: { slug: entry.slug } });
    if (!platform) {
      console.log(`${entry.slug}: platform missing, skipped`);
      continue;
    }
    await prisma.game.create({
      data: {
        gameFamilyId: family.id,
        platformId: platform.id,
        releaseDate: new Date(entry.date),
        coverUrl: entry.coverUrl ?? null,
        ...(entry.versionId ? { versions: { connect: [{ id: entry.versionId }] } } : {}),
      },
    });
    console.log(`${entry.slug}: created`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
