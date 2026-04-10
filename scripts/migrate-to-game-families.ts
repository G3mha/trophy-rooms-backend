/**
 * Migration Script: Migrate to GameFamily Architecture
 *
 * This script migrates the existing Game-centric data model to the new GameFamily architecture:
 * 1. Groups games by title (case-insensitive)
 * 2. Creates GameFamily entries with canonical metadata
 * 3. Links existing Games to their GameFamily
 * 4. Migrates AchievementSets from gameId to gameFamilyId
 * 5. Migrates DLCs from gameId to gameFamilyId
 * 6. Migrates Bundle games to Bundle gameFamilies
 * 7. Migrates baseGames self-references to baseGameFamilies
 *
 * Run with: npx tsx scripts/migrate-to-game-families.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);
}

async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (await prisma.gameFamily.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

async function migrate() {
  console.log("Starting migration to GameFamily architecture...\n");

  // Step 1: Get all existing games grouped by title (case-insensitive)
  console.log("Step 1: Fetching all games and grouping by title...");
  const allGames = await prisma.game.findMany({
    include: {
      platform: true,
      _count: {
        select: {
          trophies: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Note: Since we've removed title from Game in the schema, we need to use raw query
  // to get the old title data. This script assumes it runs BEFORE the cleanup migration
  // that removes the title column.

  // Actually, we need to handle this differently. The schema has already been changed.
  // Let's check if we can still access the data through a raw query.

  console.log(`Found ${allGames.length} games total\n`);

  // For this migration script to work, we need to run it AFTER adding the new columns
  // but BEFORE removing the old columns. Since we've already modified the schema to
  // remove title/description etc from Game, we'll need to use raw SQL to access
  // the old data if it still exists.

  // Let's check if title column still exists
  try {
    const testGame = await prisma.$queryRaw<{ title: string }[]>`
      SELECT title FROM "Game" LIMIT 1
    `;
    console.log("Title column still exists, proceeding with migration...\n");
  } catch {
    console.log(
      "Title column has been removed from Game table. Cannot proceed with migration."
    );
    console.log(
      "This script must run BEFORE the cleanup migration that removes old columns."
    );
    return;
  }

  // Get games with their old metadata using raw SQL
  interface OldGameData {
    id: string;
    title: string;
    description: string | null;
    coverUrl: string | null;
    releaseDate: Date | null;
    developer: string | null;
    publisher: string | null;
    genre: string | null;
    esrbRating: string | null;
    screenshots: string[];
    type: string;
    platformId: string | null;
  }

  const gamesWithOldData = await prisma.$queryRaw<OldGameData[]>`
    SELECT
      id,
      title,
      description,
      "coverUrl",
      "releaseDate",
      developer,
      publisher,
      genre,
      "esrbRating",
      screenshots,
      type,
      "platformId"
    FROM "Game"
    ORDER BY "createdAt" ASC
  `;

  // Group games by title (case-insensitive)
  const gamesByTitle = new Map<string, OldGameData[]>();
  for (const game of gamesWithOldData) {
    const normalizedTitle = game.title.toLowerCase().trim();
    const existing = gamesByTitle.get(normalizedTitle) || [];
    existing.push(game);
    gamesByTitle.set(normalizedTitle, existing);
  }

  console.log(`Found ${gamesByTitle.size} unique game titles\n`);

  // Step 2: Create GameFamily for each unique title
  console.log("Step 2: Creating GameFamily entries...");

  const gameFamilyMap = new Map<string, string>(); // gameId -> gameFamilyId
  const titleToFamilyId = new Map<string, string>(); // normalizedTitle -> gameFamilyId

  let familiesCreated = 0;

  for (const [normalizedTitle, games] of gamesByTitle) {
    // Use the first game's metadata as the canonical data
    const primaryGame = games[0];
    const baseSlug = generateSlug(primaryGame.title);
    const slug = await ensureUniqueSlug(baseSlug);

    // Create the GameFamily
    const gameFamily = await prisma.gameFamily.create({
      data: {
        title: primaryGame.title,
        slug,
        description: primaryGame.description,
        coverUrl: primaryGame.coverUrl,
        developer: primaryGame.developer,
        publisher: primaryGame.publisher,
        genre: primaryGame.genre,
        esrbRating: primaryGame.esrbRating,
        screenshots: primaryGame.screenshots || [],
        releaseDate: primaryGame.releaseDate,
        type: primaryGame.type as
          | "BASE_GAME"
          | "FANGAME"
          | "ROM_HACK"
          | "MOD"
          | "DLC"
          | "EXPANSION",
      },
    });

    titleToFamilyId.set(normalizedTitle, gameFamily.id);

    // Map all games with this title to this family
    for (const game of games) {
      gameFamilyMap.set(game.id, gameFamily.id);
    }

    familiesCreated++;
    if (familiesCreated % 100 === 0) {
      console.log(`  Created ${familiesCreated} game families...`);
    }
  }

  console.log(`Created ${familiesCreated} GameFamily entries\n`);

  // Step 3: Link Games to their GameFamily
  console.log("Step 3: Linking Games to GameFamilies...");

  let gamesLinked = 0;
  for (const [gameId, gameFamilyId] of gameFamilyMap) {
    await prisma.game.update({
      where: { id: gameId },
      data: { gameFamilyId },
    });
    gamesLinked++;
    if (gamesLinked % 100 === 0) {
      console.log(`  Linked ${gamesLinked} games...`);
    }
  }

  console.log(`Linked ${gamesLinked} games to their families\n`);

  // Step 4: Migrate AchievementSets from gameId to gameFamilyId
  console.log("Step 4: Migrating AchievementSets to GameFamily...");

  // Get all achievement sets with their gameId using raw SQL
  interface AchievementSetData {
    id: string;
    gameId: string;
  }

  const achievementSets = await prisma.$queryRaw<AchievementSetData[]>`
    SELECT id, "gameId" FROM "AchievementSet" WHERE "gameId" IS NOT NULL
  `;

  let achievementSetsUpdated = 0;
  const processedSets = new Set<string>(); // Track unique family+title+type combinations

  for (const set of achievementSets) {
    const gameFamilyId = gameFamilyMap.get(set.gameId);
    if (gameFamilyId) {
      // Get the full achievement set data
      const fullSet = await prisma.achievementSet.findUnique({
        where: { id: set.id },
        include: { achievements: true },
      });

      if (fullSet) {
        const key = `${gameFamilyId}:${fullSet.title}:${fullSet.type}:${fullSet.createdByUserId || "null"}`;

        if (processedSets.has(key)) {
          // This is a duplicate - we should merge achievements or skip
          // For now, we'll link it to the family but mark it for potential cleanup
          console.log(
            `  Warning: Duplicate achievement set found: ${fullSet.title} for family ${gameFamilyId}`
          );
        }
        processedSets.add(key);

        await prisma.achievementSet.update({
          where: { id: set.id },
          data: { gameFamilyId },
        });
        achievementSetsUpdated++;
      }
    }
  }

  console.log(`Updated ${achievementSetsUpdated} achievement sets\n`);

  // Step 5: Migrate DLCs from gameId to gameFamilyId
  console.log("Step 5: Migrating DLCs to GameFamily...");

  interface DLCData {
    id: string;
    gameId: string;
    slug: string;
  }

  const dlcs = await prisma.$queryRaw<DLCData[]>`
    SELECT id, "gameId", slug FROM "DLC" WHERE "gameId" IS NOT NULL
  `;

  let dlcsUpdated = 0;
  const processedDlcs = new Set<string>(); // Track unique family+slug combinations

  for (const dlc of dlcs) {
    const gameFamilyId = gameFamilyMap.get(dlc.gameId);
    if (gameFamilyId) {
      const key = `${gameFamilyId}:${dlc.slug}`;

      if (processedDlcs.has(key)) {
        console.log(
          `  Warning: Duplicate DLC found: ${dlc.slug} for family ${gameFamilyId}`
        );
        // Skip duplicates - they'll need to be handled separately
        continue;
      }
      processedDlcs.add(key);

      await prisma.dLC.update({
        where: { id: dlc.id },
        data: { gameFamilyId },
      });
      dlcsUpdated++;
    }
  }

  console.log(`Updated ${dlcsUpdated} DLCs\n`);

  // Step 6: Migrate Bundle games to Bundle gameFamilies
  console.log("Step 6: Migrating Bundle game relationships...");

  // Get bundle-game relationships using raw SQL
  interface BundleGameData {
    bundleId: string;
    gameId: string;
  }

  const bundleGames = await prisma.$queryRaw<BundleGameData[]>`
    SELECT "A" as "bundleId", "B" as "gameId"
    FROM "_BundleGames"
  `;

  // Group by bundle and get unique family IDs
  const bundleFamilies = new Map<string, Set<string>>();
  for (const bg of bundleGames) {
    const gameFamilyId = gameFamilyMap.get(bg.gameId);
    if (gameFamilyId) {
      const existing = bundleFamilies.get(bg.bundleId) || new Set();
      existing.add(gameFamilyId);
      bundleFamilies.set(bg.bundleId, existing);
    }
  }

  // Update bundles with their game families
  let bundlesUpdated = 0;
  for (const [bundleId, familyIds] of bundleFamilies) {
    await prisma.bundle.update({
      where: { id: bundleId },
      data: {
        gameFamilies: {
          connect: Array.from(familyIds).map((id) => ({ id })),
        },
      },
    });
    bundlesUpdated++;
  }

  console.log(`Updated ${bundlesUpdated} bundles with game families\n`);

  // Step 7: Migrate baseGames self-references to baseGameFamilies
  console.log("Step 7: Migrating baseGames to baseGameFamilies...");

  interface BaseGameRelation {
    derivedId: string;
    baseId: string;
  }

  const baseGameRelations = await prisma.$queryRaw<BaseGameRelation[]>`
    SELECT "A" as "derivedId", "B" as "baseId"
    FROM "_GameBaseGames"
  `;

  // For each derived game, find its family and link to base game's family
  const familyBaseRelations = new Map<string, Set<string>>(); // derivedFamilyId -> Set<baseFamilyId>

  for (const rel of baseGameRelations) {
    const derivedFamilyId = gameFamilyMap.get(rel.derivedId);
    const baseFamilyId = gameFamilyMap.get(rel.baseId);

    if (derivedFamilyId && baseFamilyId && derivedFamilyId !== baseFamilyId) {
      const existing = familyBaseRelations.get(derivedFamilyId) || new Set();
      existing.add(baseFamilyId);
      familyBaseRelations.set(derivedFamilyId, existing);
    }
  }

  // Update family base game relationships
  let familyRelationsCreated = 0;
  for (const [derivedFamilyId, baseFamilyIds] of familyBaseRelations) {
    await prisma.gameFamily.update({
      where: { id: derivedFamilyId },
      data: {
        baseGameFamilies: {
          connect: Array.from(baseFamilyIds).map((id) => ({ id })),
        },
      },
    });
    familyRelationsCreated++;
  }

  console.log(`Created ${familyRelationsCreated} family base-game relationships\n`);

  // Summary
  console.log("=".repeat(50));
  console.log("Migration Summary:");
  console.log(`  - Game Families created: ${familiesCreated}`);
  console.log(`  - Games linked: ${gamesLinked}`);
  console.log(`  - Achievement Sets updated: ${achievementSetsUpdated}`);
  console.log(`  - DLCs updated: ${dlcsUpdated}`);
  console.log(`  - Bundles updated: ${bundlesUpdated}`);
  console.log(`  - Family relationships created: ${familyRelationsCreated}`);
  console.log("=".repeat(50));
  console.log("\nMigration completed successfully!");
  console.log("\nNext steps:");
  console.log("1. Verify data integrity by checking a few game families");
  console.log("2. Run the cleanup migration to drop old columns");
  console.log("3. Update the GraphQL API to use the new schema");
}

migrate()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
