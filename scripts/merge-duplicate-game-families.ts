import { GameType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    apply: args.includes("--apply"),
    limit: (() => {
      const index = args.findIndex((arg) => arg === "--limit" || arg === "-l");
      const value = index >= 0 ? args[index + 1] : undefined;
      const parsed = value ? Number.parseInt(value, 10) : undefined;
      return Number.isFinite(parsed) && parsed && parsed > 0 ? parsed : undefined;
    })(),
  };
}

async function main() {
  const { apply, limit } = parseArgs();

  console.log("=== Merge Duplicate Game Families ===\n");
  console.log(`Mode: ${apply ? "apply" : "dry run"}`);
  if (limit) {
    console.log(`Limit: ${limit}`);
  }
  console.log("");

  const families = await prisma.gameFamily.findMany({
    where: { type: GameType.BASE_GAME },
    select: {
      id: true,
      title: true,
      slug: true,
      createdAt: true,
      games: {
        select: {
          id: true,
          platformId: true,
        },
      },
      achievementSets: {
        select: {
          id: true,
        },
      },
      dlcs: {
        select: {
          id: true,
          slug: true,
        },
      },
      buylistItems: {
        select: {
          id: true,
        },
      },
      bundles: {
        select: {
          id: true,
        },
      },
      baseGameFamilies: {
        select: {
          id: true,
        },
      },
      derivedGameFamilies: {
        select: {
          id: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const groupedFamilies = new Map<string, typeof families>();
  for (const family of families) {
    const key = normalizeTitle(family.title);
    const existing = groupedFamilies.get(key) ?? [];
    existing.push(family);
    groupedFamilies.set(key, existing);
  }

  const duplicateGroups = Array.from(groupedFamilies.values())
    .filter((group) => group.length > 1)
    .slice(0, limit);

  let mergedGroups = 0;
  let mergedGames = 0;
  let deletedFamilies = 0;
  let skippedGroups = 0;

  for (const group of duplicateGroups) {
    const canonicalFamily = group[0];
    const duplicateFamilies = group.slice(1);

    const canonicalPlatformIds = new Set(
      canonicalFamily.games.map((game) => game.platformId).filter((platformId): platformId is string => Boolean(platformId))
    );
    const duplicatePlatformIds = duplicateFamilies.flatMap((family) =>
      family.games.map((game) => game.platformId).filter((platformId): platformId is string => Boolean(platformId))
    );

    const hasPlatformOverlap = duplicatePlatformIds.some((platformId) =>
      canonicalPlatformIds.has(platformId)
    );

    const hasUnsafeRelations = duplicateFamilies.some((family) =>
      family.achievementSets.length > 0 ||
      family.dlcs.length > 0 ||
      family.buylistItems.length > 0 ||
      family.bundles.length > 0 ||
      family.baseGameFamilies.length > 0 ||
      family.derivedGameFamilies.length > 0
    );

    if (hasPlatformOverlap || hasUnsafeRelations) {
      skippedGroups++;
      console.log(`Skipping "${canonicalFamily.title}"`);
      if (hasPlatformOverlap) {
        console.log("  reason: platform overlap");
      }
      if (hasUnsafeRelations) {
        console.log("  reason: related records on duplicate family");
      }
      continue;
    }

    const duplicateGameIds = duplicateFamilies.flatMap((family) => family.games.map((game) => game.id));
    console.log(
      `${apply ? "Merging" : "Would merge"} "${canonicalFamily.title}" -> ${canonicalFamily.slug} (${duplicateFamilies.length} duplicate families, ${duplicateGameIds.length} games)`
    );

    if (!apply) {
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.game.updateMany({
        where: {
          id: {
            in: duplicateGameIds,
          },
        },
        data: {
          gameFamilyId: canonicalFamily.id,
        },
      });

      await tx.gameFamily.deleteMany({
        where: {
          id: {
            in: duplicateFamilies.map((family) => family.id),
          },
        },
      });
    });

    mergedGroups++;
    mergedGames += duplicateGameIds.length;
    deletedFamilies += duplicateFamilies.length;
  }

  console.log("");
  console.log(`Duplicate groups inspected: ${duplicateGroups.length}`);
  console.log(`${apply ? "Merged" : "Mergeable"} groups: ${apply ? mergedGroups : duplicateGroups.length - skippedGroups}`);
  console.log(`${apply ? "Moved" : "Would move"} games: ${apply ? mergedGames : "n/a"}`);
  console.log(`${apply ? "Deleted" : "Would delete"} duplicate families: ${apply ? deletedFamilies : "n/a"}`);
  console.log(`Skipped groups: ${skippedGroups}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
