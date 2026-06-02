/**
 * Backfill searchTitle for all GameFamily records.
 * This script normalizes existing titles for improved search matching.
 * Uses a single SQL UPDATE for efficiency.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Backfill Search Titles ===\n");

  // Get count of records to update
  const totalCount = await prisma.gameFamily.count();
  console.log(`Total GameFamily records: ${totalCount}`);

  // Get records missing searchTitle
  const missingCount = await prisma.gameFamily.count({
    where: { searchTitle: null },
  });
  console.log(`Records missing searchTitle: ${missingCount}\n`);

  if (missingCount === 0) {
    console.log("All records already have searchTitle. Nothing to do.");
    return;
  }

  console.log("Updating all records with normalized searchTitle...");

  // Use a single SQL UPDATE with PostgreSQL string functions
  // This normalizes: lowercase, remove accents (via unaccent if available, or translate), remove non-alphanumeric
  const result = await prisma.$executeRaw`
    UPDATE "GameFamily"
    SET "searchTitle" = LOWER(
      REGEXP_REPLACE(
        TRANSLATE(
          NORMALIZE(title, NFD),
          'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ',
          'AAAAAAACEEEEIIIIDNOOOOOOUUUUYBsaaaaaaaceeeeiiiidnoooooouuuuyby'
        ),
        '[^a-zA-Z0-9]',
        '',
        'g'
      )
    )
    WHERE "searchTitle" IS NULL
  `;

  console.log(`Updated ${result} records.\n`);

  console.log("=== Backfill Complete ===");

  // Show some examples
  console.log("\nSample normalized titles:");
  const samples = await prisma.gameFamily.findMany({
    take: 10,
    select: { title: true, searchTitle: true },
    orderBy: { title: "asc" },
  });

  for (const sample of samples) {
    console.log(`  "${sample.title}" → "${sample.searchTitle}"`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
