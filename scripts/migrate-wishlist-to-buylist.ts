import { BuylistPriority, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting Wishlist to Buylist migration...");

  // Find all UserGame entries with WISHLIST status
  const wishlistItems = await prisma.userGame.findMany({
    where: { status: "WISHLIST" },
    include: {
      game: true,
      gameVersion: true,
    },
  });

  console.log(`Found ${wishlistItems.length} wishlist items to migrate.`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const item of wishlistItems) {
    try {
      // Check if already exists in buylist
      const existing = await prisma.buylistItem.findFirst({
        where: {
          userId: item.userId,
          gameId: item.gameId,
          gameVersionId: item.gameVersionId,
          dlcId: null,
          bundleId: null,
        },
      });

      if (existing) {
        console.log(`Skipping game "${item.game.title}" - already in buylist`);
        skipped++;
        continue;
      }

      // Create buylist item
      await prisma.buylistItem.create({
        data: {
          userId: item.userId,
          gameId: item.gameId,
          gameVersionId: item.gameVersionId,
          dlcId: null,
          bundleId: null,
          priority: BuylistPriority.MEDIUM,
          notes: null,
          estimatedPrice: null,
          addedAt: item.createdAt,
        },
      });

      console.log(`Migrated game "${item.game.title}" to buylist`);
      migrated++;
    } catch (error) {
      console.error(`Error migrating game "${item.game.title}":`, error);
      errors++;
    }
  }

  console.log("\nMigration complete!");
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);

  // Delete the migrated wishlist items
  const deleteResult = await prisma.userGame.deleteMany({
    where: { status: "WISHLIST" },
  });
  console.log(`\nDeleted ${deleteResult.count} wishlist entries from UserGame.`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Migration failed:", error);
  prisma.$disconnect();
  process.exit(1);
});
