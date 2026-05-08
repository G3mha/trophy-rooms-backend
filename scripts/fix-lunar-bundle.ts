/**
 * Fix Lunar Remastered Collection - disconnect wrong games and connect correct ones
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Fix Lunar Remastered Collection ===\n");

  // First, disconnect all wrong game families
  await prisma.bundle.update({
    where: { slug: "lunar-remastered-collection" },
    data: {
      gameFamilies: { set: [] }
    }
  });
  console.log("Disconnected wrong game families");

  // Search for correct Lunar games
  const lunar1 = await prisma.gameFamily.findFirst({
    where: { title: { contains: "Lunar: Silver Star", mode: "insensitive" } }
  });
  const lunar2 = await prisma.gameFamily.findFirst({
    where: { title: { contains: "Lunar 2: Eternal Blue", mode: "insensitive" } }
  });
  // Also try alternate names
  const lunar1Alt = await prisma.gameFamily.findFirst({
    where: { title: { contains: "Lunar Silver Star", mode: "insensitive" } }
  });
  const lunar2Alt = await prisma.gameFamily.findFirst({
    where: { title: { contains: "Lunar 2 Eternal Blue", mode: "insensitive" } }
  });

  console.log("\nSearching for Lunar games:");
  console.log("  Lunar 1:", lunar1?.title || lunar1Alt?.title || "Not found");
  console.log("  Lunar 2:", lunar2?.title || lunar2Alt?.title || "Not found");

  // If they exist, connect them
  const toConnect = [lunar1, lunar2, lunar1Alt, lunar2Alt].filter((g): g is NonNullable<typeof g> => g !== null);

  // Remove duplicates by id
  const uniqueGames = [...new Map(toConnect.map(g => [g.id, g])).values()];

  if (uniqueGames.length > 0) {
    await prisma.bundle.update({
      where: { slug: "lunar-remastered-collection" },
      data: {
        gameFamilies: { connect: uniqueGames.map(g => ({ id: g.id })) }
      }
    });
    console.log("\nConnected", uniqueGames.length, "games:");
    for (const g of uniqueGames) {
      console.log("  -", g.title);
    }
  } else {
    console.log("\nNo Lunar games found in database. They may need to be imported first.");
  }

  // Show final state
  const bundle = await prisma.bundle.findUnique({
    where: { slug: "lunar-remastered-collection" },
    include: { gameFamilies: true, platforms: true }
  });

  console.log("\nFinal bundle state:");
  console.log("  Name:", bundle?.name);
  console.log("  Platforms:", bundle?.platforms.map(p => p.name).join(", "));
  console.log("  Games:", bundle?.gameFamilies.length || 0);
  if (bundle?.gameFamilies) {
    for (const gf of bundle.gameFamilies) {
      console.log("    -", gf.title);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
