/**
 * Migrate UserBundle rows into CollectionItem.
 *
 * Bundle ownership now lives in CollectionItem (bundleId instead of gameId),
 * so bundles carry region and condition and can be sold like any other
 * physical item. Copies platform, purchase info, and ownership date;
 * region/condition stay at their defaults for the user to edit.
 *
 * Idempotent: skips UserBundles that already have a matching CollectionItem.
 * UserBundle rows are kept as a backup; the model is dropped separately once
 * everything is verified.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Migrate UserBundles to CollectionItems ===\n");

  const userBundles = await prisma.userBundle.findMany();
  console.log(`Found ${userBundles.length} UserBundle rows`);

  let migrated = 0;
  let skipped = 0;

  for (const ub of userBundles) {
    const existing = await prisma.collectionItem.findFirst({
      where: {
        userId: ub.userId,
        bundleId: ub.bundleId,
        platformId: ub.platformId,
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.collectionItem.create({
      data: {
        userId: ub.userId,
        bundleId: ub.bundleId,
        platformId: ub.platformId,
        purchasePrice: ub.purchasePrice,
        purchasedAt: ub.purchasedAt,
        createdAt: ub.ownedAt,
      },
    });
    migrated++;
  }

  console.log(`Migrated: ${migrated}, skipped (already present): ${skipped}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
