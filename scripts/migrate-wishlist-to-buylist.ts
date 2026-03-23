import { BuylistPriority, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface WishlistItem {
  id: string;
  userId: string;
  gameId: string;
  gameVersionId: string | null;
  createdAt: Date;
  gameTitle: string;
}

async function main() {
  console.log("Starting Wishlist to Buylist migration...");

  // Use raw SQL to find WISHLIST items since it's been removed from the enum
  const wishlistItems = await prisma.$queryRaw<WishlistItem[]>`
    SELECT ug.id, ug."userId", ug."gameId", ug."gameVersionId", ug."createdAt", g.title as "gameTitle"
    FROM "UserGame" ug
    JOIN "Game" g ON ug."gameId" = g.id
    WHERE ug.status = 'WISHLIST'
  `;

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
        console.log(`Skipping game "${item.gameTitle}" - already in buylist`);
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

      console.log(`Migrated game "${item.gameTitle}" to buylist`);
      migrated++;
    } catch (error) {
      console.error(`Error migrating game "${item.gameTitle}":`, error);
      errors++;
    }
  }

  console.log("\nMigration complete!");
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);

  // Delete the migrated wishlist items using raw SQL
  const deleteResult = await prisma.$executeRaw`
    DELETE FROM "UserGame" WHERE status = 'WISHLIST'
  `;
  console.log(`\nDeleted ${deleteResult} wishlist entries from UserGame.`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Migration failed:", error);
  prisma.$disconnect();
  process.exit(1);
});
