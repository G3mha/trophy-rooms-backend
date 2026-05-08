/**
 * Merge duplicate Castlevania bundles into single multi-platform bundles
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Merge Duplicate Bundles ===\n");

  // Bundles to merge: [keepSlug, deleteSlug]
  const toMerge = [
    ["castlevania-anniversary-collection", "castlevania-anniversary-collection-ps4"],
    ["castlevania-advance-collection", "castlevania-advance-collection-ps4"],
  ];

  for (const [keepSlug, deleteSlug] of toMerge) {
    const keepBundle = await prisma.bundle.findUnique({
      where: { slug: keepSlug },
      include: { platforms: true },
    });

    const deleteBundle = await prisma.bundle.findUnique({
      where: { slug: deleteSlug },
      include: { platforms: true },
    });

    if (!keepBundle || !deleteBundle) {
      console.log("Bundle not found:", keepSlug, "or", deleteSlug);
      continue;
    }

    console.log("Merging:", deleteBundle.name, "(" + deleteSlug + ")");
    console.log("  Into:", keepBundle.name, "(" + keepSlug + ")");

    // Get platforms from both
    const allPlatformIds = new Set([
      ...keepBundle.platforms.map((p) => p.id),
      ...deleteBundle.platforms.map((p) => p.id),
    ]);

    // Update the keep bundle with all platforms
    await prisma.bundle.update({
      where: { id: keepBundle.id },
      data: {
        platforms: {
          set: Array.from(allPlatformIds).map((id) => ({ id })),
        },
      },
    });

    // Delete the duplicate bundle
    await prisma.bundle.delete({
      where: { id: deleteBundle.id },
    });

    console.log("  Merged! Platforms:", Array.from(allPlatformIds).length);
    console.log("");
  }

  // Verify
  const bundles = await prisma.bundle.findMany({
    where: { name: { contains: "Castlevania", mode: "insensitive" } },
    include: { platforms: true },
    orderBy: { name: "asc" },
  });

  console.log("Final Castlevania Bundles:");
  for (const b of bundles) {
    console.log("-", b.name);
    console.log("  Platforms:", b.platforms.map((p) => p.name).join(", "));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
