/**
 * Audit: Switch 1 special editions vs DB state.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TITLES = [
  "Mario Kart 8",
  "New Super Mario Bros. U",
  "Pikmin 3",
  "Hyrule Warriors",
  "Pokkén",
  "Return to Dream Land",
  "Xenoblade Chronicles",
  "Witcher 3",
  "Persona 5",
  "Dragon Quest XI",
  "Catherine",
  "Divinity: Original Sin",
  "Dark Souls",
  "Grand Theft Auto: The Trilogy",
];

async function main() {
  for (const t of TITLES) {
    const families = await prisma.gameFamily.findMany({
      where: { title: { contains: t, mode: "insensitive" } },
      include: { games: { include: { platform: true, versions: true } } },
    });
    if (families.length === 0) {
      console.log(`MISSING FAMILY  ${t}`);
      continue;
    }
    for (const family of families) {
      console.log(`"${family.title}"`);
      for (const g of family.games) {
        console.log(
          `   ${g.platform?.slug}: release=${g.releaseDate?.toISOString().split("T")[0] ?? "null"} versions=[${g.versions.map((v) => v.name).join(" | ")}]`
        );
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
