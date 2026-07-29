/**
 * Final Fantasy PS1 collections + Pixel Remasters (2026-07-23).
 *
 * PS1 collections (COLLECTION bundles with compilation-carrier games):
 * - Final Fantasy Anthology (NA 1999-09-30): FFV + FFVI
 * - Final Fantasy Chronicles (NA 2001-06-29): FFIV + Chrono Trigger
 *   (creates Chrono Trigger with its SNES original if missing)
 * - Final Fantasy Origins (NA 2003-04-08): FFI + FFII
 *
 * Pixel Remasters: per-family "Pixel Remaster" versions (single-family, so
 * they may carry art) on new Steam (2021-2022 staggered) and PS4/Switch
 * (2023-04-19) games for FF I-VI, plus the physical
 * "Final Fantasy I-VI Pixel Remaster Collection" bundle.
 */

import { PrismaClient, BundleType } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";
import { normalizeForSearch } from "../src/lib/normalize-search.js";

const prisma = new PrismaClient();

async function igdbBySlug(slugs: string[]): Promise<IGDBGame | null> {
  for (const slug of slugs) {
    try {
      const [game] = await igdbRequest<IGDBGame[]>(
        "games",
        `fields id, name, slug, summary, cover.image_id, first_release_date;
         where slug = "${slug}"; limit 1;`
      );
      if (game) return game;
    } catch {
      // try next
    }
  }
  return null;
}

function coverOf(game: IGDBGame | null): string | null {
  return game?.cover?.image_id ? getCoverUrl(game.cover.image_id, "cover_big") : null;
}

async function family(title: string) {
  return prisma.gameFamily.findFirst({
    where: { title: { equals: title, mode: "insensitive" } },
    include: { games: { include: { platform: true } } },
  });
}

async function addCarrier(familyTitle: string, platformSlug: string, date: string) {
  const fam = await family(familyTitle);
  const platform = await prisma.platform.findUnique({ where: { slug: platformSlug } });
  if (!fam || !platform) {
    console.log(`${familyTitle} ${platformSlug}: missing family or platform`);
    return;
  }
  const existing = await prisma.game.findFirst({
    where: { gameFamilyId: fam.id, platformId: platform.id },
  });
  if (existing) {
    console.log(`${familyTitle} ${platformSlug}: already exists`);
    return;
  }
  await prisma.game.create({
    data: {
      gameFamilyId: fam.id,
      platformId: platform.id,
      releaseDate: new Date(date),
    },
  });
  console.log(`${familyTitle} ${platformSlug}: carrier created`);
}

async function createBundle(opts: {
  name: string;
  slug: string;
  igdbSlugs: string[];
  date: string;
  platforms: string[];
  familyTitles: string[];
}) {
  const existing = await prisma.bundle.findUnique({ where: { slug: opts.slug } });
  if (existing) {
    console.log(`${opts.name}: bundle already exists`);
    return;
  }
  const families = await prisma.gameFamily.findMany({
    where: {
      OR: opts.familyTitles.map((t) => ({ title: { equals: t, mode: "insensitive" as const } })),
    },
    select: { id: true },
  });
  if (families.length !== opts.familyTitles.length) {
    console.error(`${opts.name}: only ${families.length}/${opts.familyTitles.length} members, skipped`);
    return;
  }
  const platformIds: string[] = [];
  for (const slug of opts.platforms) {
    const p = await prisma.platform.findUnique({ where: { slug } });
    if (p) platformIds.push(p.id);
  }
  const igdb = await igdbBySlug(opts.igdbSlugs);
  await prisma.bundle.create({
    data: {
      name: opts.name,
      slug: opts.slug,
      type: BundleType.COLLECTION,
      description: igdb?.summary || null,
      coverUrl: coverOf(igdb),
      releaseDate: new Date(opts.date),
      platforms: { connect: platformIds.map((id) => ({ id })) },
      gameFamilies: { connect: families.map((f) => ({ id: f.id })) },
    },
  });
  console.log(`Created bundle: ${opts.name}`);
}

async function main() {
  console.log("=== FF PS1 collections + Pixel Remasters ===\n");

  // --- Chrono Trigger (needed for Chronicles) ---
  const ct = await prisma.gameFamily.findFirst({
    where: { title: { equals: "Chrono Trigger", mode: "insensitive" } },
  });
  if (!ct) {
    const igdb = await igdbBySlug(["chrono-trigger"]);
    const created = await prisma.gameFamily.create({
      data: {
        title: "Chrono Trigger",
        slug: "chrono-trigger",
        searchTitle: normalizeForSearch("Chrono Trigger"),
        description: igdb?.summary || null,
        coverUrl: coverOf(igdb),
        releaseDate: new Date("1995-08-22"),
      },
    });
    const snes = await prisma.platform.findUnique({ where: { slug: "snes" } });
    const standard = await prisma.gameVersion.findUnique({ where: { slug: "standard" } });
    if (snes) {
      await prisma.game.create({
        data: {
          gameFamilyId: created.id,
          platformId: snes.id,
          releaseDate: new Date("1995-08-22"),
          ...(standard ? { versions: { connect: [{ id: standard.id }] } } : {}),
        },
      });
    }
    console.log("Chrono Trigger: created (SNES 1995-08-22)");
  } else {
    console.log("Chrono Trigger: already exists");
  }

  // --- PS1 collection carriers + bundles ---
  console.log("");
  await addCarrier("Final Fantasy V", "ps1", "1999-09-30");
  await addCarrier("Final Fantasy VI", "ps1", "1999-09-30");
  await createBundle({
    name: "Final Fantasy Anthology",
    slug: "final-fantasy-anthology",
    igdbSlugs: ["final-fantasy-anthology"],
    date: "1999-09-30",
    platforms: ["ps1"],
    familyTitles: ["Final Fantasy V", "Final Fantasy VI"],
  });

  await addCarrier("Final Fantasy IV", "ps1", "2001-06-29");
  await addCarrier("Chrono Trigger", "ps1", "2001-06-29");
  await createBundle({
    name: "Final Fantasy Chronicles",
    slug: "final-fantasy-chronicles",
    igdbSlugs: ["final-fantasy-chronicles"],
    date: "2001-06-29",
    platforms: ["ps1"],
    familyTitles: ["Final Fantasy IV", "Chrono Trigger"],
  });

  await addCarrier("Final Fantasy", "ps1", "2003-04-08");
  await addCarrier("Final Fantasy II", "ps1", "2003-04-08");
  await createBundle({
    name: "Final Fantasy Origins",
    slug: "final-fantasy-origins",
    igdbSlugs: ["final-fantasy-origins"],
    date: "2003-04-08",
    platforms: ["ps1"],
    familyTitles: ["Final Fantasy", "Final Fantasy II"],
  });

  // --- Pixel Remasters ---
  console.log("");
  const CONSOLE_DATE = "2023-04-19";
  const PR = [
    { familyTitle: "Final Fantasy", familySlug: "final-fantasy", steamDate: "2021-07-28" },
    { familyTitle: "Final Fantasy II", familySlug: "final-fantasy-ii", steamDate: "2021-07-28" },
    { familyTitle: "Final Fantasy III", familySlug: "final-fantasy-iii", steamDate: "2021-07-28" },
    { familyTitle: "Final Fantasy IV", familySlug: "final-fantasy-iv", steamDate: "2021-09-08" },
    { familyTitle: "Final Fantasy V", familySlug: "final-fantasy-v", steamDate: "2021-11-10" },
    { familyTitle: "Final Fantasy VI", familySlug: "final-fantasy-vi", steamDate: "2022-02-23" },
  ];

  for (const pr of PR) {
    const fam = await family(pr.familyTitle);
    if (!fam) {
      console.log(`${pr.familyTitle}: family missing, skipped`);
      continue;
    }
    const versionSlug = `pixel-remaster-${pr.familySlug}`;
    const prArt = coverOf(
      await igdbBySlug([
        `${pr.familySlug}-pixel-remaster`,
        `${pr.familySlug}--pixel-remaster`,
      ])
    );
    let version = await prisma.gameVersion.findUnique({ where: { slug: versionSlug } });
    if (!version) {
      version = await prisma.gameVersion.create({
        data: {
          name: "Pixel Remaster",
          slug: versionSlug,
          coverUrl: prArt,
          releaseDate: new Date(pr.steamDate),
          isDefault: false,
        },
      });
    }

    for (const [platformSlug, date] of [
      ["steam", pr.steamDate],
      ["ps4", CONSOLE_DATE],
      ["switch", CONSOLE_DATE],
    ] as const) {
      const platform = await prisma.platform.findUnique({ where: { slug: platformSlug } });
      if (!platform) continue;
      const existing = await prisma.game.findFirst({
        where: { gameFamilyId: fam.id, platformId: platform.id },
        include: { versions: { select: { id: true } } },
      });
      if (existing) {
        if (!existing.versions.some((v) => v.id === version.id)) {
          await prisma.game.update({
            where: { id: existing.id },
            data: { versions: { connect: [{ id: version.id }] } },
          });
          await prisma.gameVersionReleaseDate.upsert({
            where: { gameId_gameVersionId: { gameId: existing.id, gameVersionId: version.id } },
            update: { releaseDate: new Date(date) },
            create: { gameId: existing.id, gameVersionId: version.id, releaseDate: new Date(date) },
          });
          console.log(`${pr.familyTitle} ${platformSlug}: PR version linked to existing game`);
        }
        continue;
      }
      const game = await prisma.game.create({
        data: {
          gameFamilyId: fam.id,
          platformId: platform.id,
          releaseDate: new Date(date),
          coverUrl: prArt,
          versions: { connect: [{ id: version.id }] },
        },
      });
      await prisma.gameVersionReleaseDate.upsert({
        where: { gameId_gameVersionId: { gameId: game.id, gameVersionId: version.id } },
        update: { releaseDate: new Date(date) },
        create: { gameId: game.id, gameVersionId: version.id, releaseDate: new Date(date) },
      });
      console.log(`${pr.familyTitle} ${platformSlug}: PR game created${prArt ? " (with art)" : ""}`);
    }
  }

  await createBundle({
    name: "Final Fantasy I-VI Pixel Remaster Collection",
    slug: "final-fantasy-i-vi-pixel-remaster-collection",
    igdbSlugs: [
      "final-fantasy-i-vi-pixel-remaster-collection",
      "final-fantasy-i-vi-bundle",
    ],
    date: "2023-04-19",
    platforms: ["ps4", "switch"],
    familyTitles: PR.map((p) => p.familyTitle),
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
