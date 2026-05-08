/**
 * Migrate Bundle platform data from single platform to many-to-many
 * Run this BEFORE applying the schema migration
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Migrate Bundle Platforms ===\n");

  // Step 1: Create the join table if it doesn't exist
  console.log("Creating join table _BundlePlatforms...");
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "_BundlePlatforms" (
      "A" TEXT NOT NULL,
      "B" TEXT NOT NULL,
      CONSTRAINT "_BundlePlatforms_AB_pkey" PRIMARY KEY ("A", "B")
    )
  `;

  // Create indexes
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "_BundlePlatforms_B_index" ON "_BundlePlatforms"("B")
  `;

  // Add foreign key constraints
  try {
    await prisma.$executeRaw`
      ALTER TABLE "_BundlePlatforms"
      ADD CONSTRAINT "_BundlePlatforms_A_fkey"
      FOREIGN KEY ("A") REFERENCES "Bundle"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
    `;
  } catch (e) {
    console.log("  FK constraint A already exists");
  }

  try {
    await prisma.$executeRaw`
      ALTER TABLE "_BundlePlatforms"
      ADD CONSTRAINT "_BundlePlatforms_B_fkey"
      FOREIGN KEY ("B") REFERENCES "Platform"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
    `;
  } catch (e) {
    console.log("  FK constraint B already exists");
  }

  console.log("Join table ready.\n");

  // Step 2: Migrate existing platform relationships
  console.log("Migrating existing bundle-platform relationships...");

  const bundlesWithPlatform = await prisma.$queryRaw<Array<{ id: string; platformId: string }>>`
    SELECT id, "platformId" FROM "Bundle" WHERE "platformId" IS NOT NULL
  `;

  console.log(`Found ${bundlesWithPlatform.length} bundles with platform.\n`);

  for (const bundle of bundlesWithPlatform) {
    // Check if relationship already exists
    const existing = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM "_BundlePlatforms"
      WHERE "A" = ${bundle.id} AND "B" = ${bundle.platformId}
    `;

    if (existing[0].count === 0n) {
      await prisma.$executeRaw`
        INSERT INTO "_BundlePlatforms" ("A", "B")
        VALUES (${bundle.id}, ${bundle.platformId})
      `;
      console.log(`Migrated: ${bundle.id} -> ${bundle.platformId}`);
    } else {
      console.log(`Already exists: ${bundle.id} -> ${bundle.platformId}`);
    }
  }

  console.log("\nMigration complete!");
  console.log("You can now run: npx prisma db push --accept-data-loss");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
