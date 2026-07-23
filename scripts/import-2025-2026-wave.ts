/**
 * Batch import of notable 2025-2026 releases missing from the DB
 * (gap analysis 2026-07-22). Creates a GameFamily with IGDB metadata and
 * platform Games per entry. Dates are explicit where confirmed; null falls
 * back to IGDB's first release date (TBA games stay null).
 *
 * "Star Fox (2026)" is disambiguated from the 1993 family. FF7 Remake's
 * post-PS4 releases are linked to an "Intergrade" version.
 */

import { PrismaClient } from "@prisma/client";
import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

const prisma = new PrismaClient();

type PlatformEntry = { slug: string; date: string | null; versionSlug?: string };
type Entry = {
  title: string;
  slug: string;
  igdbSlug?: string;
  igdbSearch: string;
  platforms: PlatformEntry[];
};

const ENTRIES: Entry[] = [
  {
    title: "Star Fox (2026)",
    slug: "star-fox-2026",
    igdbSearch: "Star Fox",
    platforms: [{ slug: "switch-2", date: "2026-06-25" }],
  },
  {
    title: "Fire Emblem: Fortune's Weave",
    slug: "fire-emblem-fortunes-weave",
    igdbSearch: "Fire Emblem: Fortune's Weave",
    platforms: [{ slug: "switch-2", date: null }],
  },
  {
    title: "Splatoon Raiders",
    slug: "splatoon-raiders",
    igdbSearch: "Splatoon Raiders",
    platforms: [{ slug: "switch-2", date: null }],
  },
  {
    title: "Nintendo Switch Sports Resort",
    slug: "nintendo-switch-sports-resort",
    igdbSearch: "Nintendo Switch Sports Resort",
    platforms: [{ slug: "switch-2", date: null }],
  },
  {
    title: "Rhythm Heaven Groove",
    slug: "rhythm-heaven-groove",
    igdbSearch: "Rhythm Heaven Groove",
    platforms: [{ slug: "switch", date: null }],
  },
  {
    title: "Tomodachi Life: Living the Dream",
    slug: "tomodachi-life-living-the-dream",
    igdbSearch: "Tomodachi Life: Living the Dream",
    platforms: [{ slug: "switch", date: null }],
  },
  {
    title: "Final Fantasy VII Remake",
    slug: "final-fantasy-vii-remake",
    igdbSlug: "final-fantasy-vii-remake",
    igdbSearch: "Final Fantasy VII Remake",
    platforms: [
      { slug: "ps4", date: "2020-04-10" },
      { slug: "ps5", date: "2021-06-10", versionSlug: "intergrade" },
      { slug: "steam", date: "2021-12-16", versionSlug: "intergrade" },
      { slug: "switch-2", date: "2026-01-22", versionSlug: "intergrade" },
      { slug: "xbox-series", date: "2026-01-22", versionSlug: "intergrade" },
    ],
  },
  {
    title: "Final Fantasy VII Rebirth",
    slug: "final-fantasy-vii-rebirth",
    igdbSlug: "final-fantasy-vii-rebirth",
    igdbSearch: "Final Fantasy VII Rebirth",
    platforms: [
      { slug: "ps5", date: "2024-02-29" },
      { slug: "steam", date: "2025-01-23" },
      { slug: "switch-2", date: "2026-06-03" },
      { slug: "xbox-series", date: "2026-06-03" },
    ],
  },
  {
    title: "Dragon Quest I & II HD-2D Remake",
    slug: "dragon-quest-i-and-ii-hd-2d-remake",
    igdbSearch: "Dragon Quest I & II HD-2D Remake",
    platforms: [
      { slug: "switch", date: "2025-10-30" },
      { slug: "switch-2", date: "2025-10-30" },
      { slug: "ps5", date: "2025-10-30" },
      { slug: "xbox-series", date: "2025-10-30" },
      { slug: "steam", date: "2025-10-30" },
    ],
  },
  {
    title: "Dragon Quest VII Reimagined",
    slug: "dragon-quest-vii-reimagined",
    igdbSearch: "Dragon Quest VII Reimagined",
    platforms: [
      { slug: "switch", date: "2026-02-05" },
      { slug: "switch-2", date: "2026-02-05" },
      { slug: "ps5", date: "2026-02-05" },
      { slug: "xbox-series", date: "2026-02-05" },
      { slug: "steam", date: "2026-02-05" },
    ],
  },
  {
    title: "Yakuza Kiwami 3",
    slug: "yakuza-kiwami-3",
    igdbSearch: "Yakuza Kiwami 3",
    platforms: [
      { slug: "ps5", date: "2026-02-12" },
      { slug: "xbox-series", date: "2026-02-12" },
      { slug: "steam", date: "2026-02-12" },
      { slug: "switch-2", date: "2026-02-12" },
    ],
  },
  {
    title: "The Duskbloods",
    slug: "the-duskbloods",
    igdbSearch: "The Duskbloods",
    platforms: [{ slug: "switch-2", date: null }],
  },
  {
    title: "007 First Light",
    slug: "007-first-light",
    igdbSearch: "007 First Light",
    platforms: [
      { slug: "ps5", date: "2026-03-27" },
      { slug: "xbox-series", date: "2026-03-27" },
      { slug: "steam", date: "2026-03-27" },
      { slug: "switch-2", date: "2026-03-27" },
    ],
  },
  {
    title: "Death Stranding 2: On the Beach",
    slug: "death-stranding-2-on-the-beach",
    igdbSearch: "Death Stranding 2: On the Beach",
    platforms: [{ slug: "ps5", date: "2025-06-26" }],
  },
  {
    title: "Ghost of Yōtei",
    slug: "ghost-of-yotei",
    igdbSearch: "Ghost of Yotei",
    platforms: [{ slug: "ps5", date: "2025-10-02" }],
  },
  {
    title: "Grand Theft Auto VI",
    slug: "grand-theft-auto-vi",
    igdbSlug: "grand-theft-auto-vi",
    igdbSearch: "Grand Theft Auto VI",
    platforms: [
      { slug: "ps5", date: "2026-11-19" },
      { slug: "xbox-series", date: "2026-11-19" },
    ],
  },
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchIgdb(entry: Entry): Promise<IGDBGame | null> {
  const fields =
    "fields id, name, slug, summary, cover.image_id, first_release_date;";

  if (entry.igdbSlug) {
    const [game] = await igdbRequest<IGDBGame[]>(
      "games",
      `${fields} where slug = "${entry.igdbSlug}"; limit 1;`
    );
    if (game) return game;
  }

  const results = await igdbRequest<IGDBGame[]>(
    "games",
    `${fields} search "${entry.igdbSearch}"; limit 10;`
  );
  const exact = results.filter(
    (g) => g.name.toLowerCase() === entry.igdbSearch.toLowerCase()
  );
  const pool = exact.length > 0 ? exact : results;
  // Prefer the newest entry - these are all 2025+ games, and searches for
  // reused names (e.g. "Star Fox") also return decades-old titles
  return (
    pool.sort(
      (a, b) => (b.first_release_date ?? 0) - (a.first_release_date ?? 0)
    )[0] ?? null
  );
}

async function findOrCreateVersion(slug: string, name: string) {
  const existing = await prisma.gameVersion.findUnique({ where: { slug } });
  if (existing) return existing;
  return prisma.gameVersion.create({
    data: { name, slug, isDefault: slug === "standard" },
  });
}

async function main() {
  console.log("=== Import 2025-2026 wave ===");

  const standard = await findOrCreateVersion("standard", "Standard");
  const intergrade = await findOrCreateVersion("intergrade", "Intergrade");
  const versionsBySlug: Record<string, { id: string }> = {
    standard,
    intergrade,
  };

  for (const entry of ENTRIES) {
    console.log(`\n--- ${entry.title} ---`);

    const existing = await prisma.gameFamily.findFirst({
      where: {
        OR: [
          { slug: entry.slug },
          { title: { equals: entry.title, mode: "insensitive" } },
        ],
      },
    });
    if (existing) {
      console.log(`Family already exists: ${existing.title}`);
      continue;
    }

    const igdbGame = await fetchIgdb(entry);
    console.log(
      "IGDB:",
      igdbGame ? `${igdbGame.name} (${igdbGame.slug})` : "not found"
    );
    const igdbDate = igdbGame?.first_release_date
      ? new Date(igdbGame.first_release_date * 1000)
      : null;

    const explicitDates = entry.platforms
      .map((p) => (p.date ? new Date(p.date) : null))
      .filter((d): d is Date => d !== null);
    const familyReleaseDate =
      explicitDates.sort((a, b) => a.getTime() - b.getTime())[0] ??
      igdbDate ??
      null;

    const family = await prisma.gameFamily.create({
      data: {
        title: entry.title,
        slug: entry.slug,
        description: igdbGame?.summary || null,
        coverUrl: igdbGame?.cover?.image_id
          ? getCoverUrl(igdbGame.cover.image_id, "cover_big")
          : null,
        releaseDate: familyReleaseDate,
      },
    });
    console.log(`Created family: ${family.id}`);

    for (const platformEntry of entry.platforms) {
      const platform = await prisma.platform.findUnique({
        where: { slug: platformEntry.slug },
      });
      if (!platform) {
        console.error(`  Platform not found: ${platformEntry.slug}, skipped`);
        continue;
      }
      const version = versionsBySlug[platformEntry.versionSlug ?? "standard"];
      const game = await prisma.game.create({
        data: {
          gameFamilyId: family.id,
          platformId: platform.id,
          releaseDate: platformEntry.date
            ? new Date(platformEntry.date)
            : igdbDate,
          versions: { connect: [{ id: version.id }] },
        },
      });
      console.log(
        `  ${platformEntry.slug}: ${game.id}${platformEntry.versionSlug ? ` (${platformEntry.versionSlug})` : ""}`
      );
    }

    await sleep(250);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
