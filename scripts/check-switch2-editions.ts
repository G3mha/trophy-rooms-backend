/**
 * Audit: Switch 2 Editions / S2 special editions vs DB state.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TITLES = [
  "Breath of the Wild",
  "Tears of the Kingdom",
  "Super Mario Party Jamboree",
  "Kirby and the Forgotten Land",
  "Legends: Z-A",
  "New Horizons",
  "Super Mario Bros. Wonder",
  "Metroid Prime 4",
  "Street Fighter 6",
  "Yakuza 0",
  "Cyberpunk 2077",
  "Hitman",
  "Elden Ring",
  "Hades II",
];

async function main() {
  for (const t of TITLES) {
    const family = await prisma.gameFamily.findFirst({
      where: { title: { contains: t, mode: "insensitive" } },
      include: {
        games: { include: { platform: true, versions: true } },
      },
    });
    if (!family) {
      console.log(`MISSING FAMILY  ${t}`);
      continue;
    }
    console.log(`"${family.title}" cover=${family.coverUrl ? "y" : "n"}`);
    for (const g of family.games) {
      console.log(
        `   ${g.platform?.slug}: release=${g.releaseDate?.toISOString().split("T")[0] ?? "null"} cover=${g.coverUrl ? "explicit" : "inherit"} versions=[${g.versions.map((v) => v.name).join(" | ")}]`
      );
    }
  }

  const s2Versions = await prisma.gameVersion.findMany({
    where: { name: { contains: "Switch 2", mode: "insensitive" } },
    select: { name: true, slug: true },
  });
  console.log("\nExisting S2-named versions:", s2Versions);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
