/**
 * Combined audit: Resident Evil + Zelda franchises, Live A Live,
 * Resident Evil Portable.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function dump(label: string, contains: string[]) {
  console.log(`\n===== ${label} =====`);
  const families = await prisma.gameFamily.findMany({
    where: { OR: contains.map((c) => ({ title: { contains: c, mode: "insensitive" as const } })) },
    include: {
      games: { include: { platform: true, versions: true } },
      _count: { select: { buylistItems: true } },
    },
    orderBy: { releaseDate: "asc" },
  });
  for (const f of families) {
    const games = f.games
      .map(
        (g) =>
          `${g.platform?.slug}@${g.releaseDate?.toISOString().split("T")[0] ?? "null"}[${g.versions.map((v) => v.name).join("|")}]`
      )
      .join("  ");
    console.log(`"${f.title}": ${games || "(no games)"}`);
  }
  const bundles = await prisma.bundle.findMany({
    where: { OR: contains.map((c) => ({ name: { contains: c, mode: "insensitive" as const } })) },
    select: { name: true },
  });
  if (bundles.length) console.log("Bundles:", bundles.map((b) => b.name));
}

async function main() {
  await dump("RESIDENT EVIL", ["Resident Evil", "biohazard"]);
  await dump("ZELDA", ["Zelda", "Hyrule", "Link's", "Tri Force"]);
  await dump("LIVE A LIVE", ["Live A Live"]);

  // RE Portable user-data check before deletion
  const portable = await prisma.gameFamily.findFirst({
    where: { title: { contains: "Resident Evil Portable", mode: "insensitive" } },
    include: {
      games: {
        include: {
          _count: { select: { userGames: true, collectionItems: true, trophies: true, buylistItems: true } },
        },
      },
    },
  });
  console.log(
    "\nRE Portable:",
    portable
      ? portable.games.map((g) => g._count)
      : "not found"
  );

  const platforms = await prisma.platform.findMany({ select: { slug: true } });
  console.log("\nAll platform slugs:", platforms.map((p) => p.slug).sort().join(", "));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
