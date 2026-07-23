/**
 * Full Metroid franchise audit.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const families = await prisma.gameFamily.findMany({
    where: {
      OR: [
        { title: { contains: "Metroid", mode: "insensitive" } },
        { title: { contains: "Samus", mode: "insensitive" } },
      ],
    },
    include: { games: { include: { platform: true, versions: true } } },
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
    where: { name: { contains: "Metroid", mode: "insensitive" } },
  });
  console.log("\nBundles:", bundles.map((b) => b.name));

  const slugs = ["nes", "snes", "game-boy", "gba", "wii", "wii-u", "3ds", "switch", "switch-2"];
  const platforms = await prisma.platform.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true },
  });
  console.log("Platforms present:", platforms.map((p) => p.slug).sort());

  const s2edition = await prisma.gameVersion.findFirst({
    where: { slug: { contains: "switch-2-edition" } },
    select: { name: true, slug: true },
  });
  console.log("Switch 2 Edition version:", s2edition ?? "none");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
