/**
 * Audit: canonical special editions across all platform eras vs DB state.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TITLES = [
  // PS2 / Xbox / GC era
  "Silent Hill 2",
  "Metal Gear Solid 2",
  "Metal Gear Solid 3",
  "Devil May Cry 3",
  "Persona 3",
  "Ninja Gaiden",
  // Wii / PS3 / X360 era
  "Resident Evil 4",
  "Oblivion",
  "Fallout 3",
  "Borderlands",
  "Red Dead Redemption",
  "Batman: Arkham Asylum",
  "Batman: Arkham City",
  "Skyrim",
  "Persona 4",
  "Final Fantasy Tactics",
  // PS4 / XB1 era
  "The Last of Us",
  "God of War III",
  "Horizon Zero Dawn",
  "Marvel's Spider-Man",
  // PS5 / XSX era
  "Ghost of Tsushima",
  "Death Stranding",
];

async function main() {
  for (const t of TITLES) {
    const families = await prisma.gameFamily.findMany({
      where: { title: { contains: t, mode: "insensitive" } },
      include: { games: { include: { platform: true, versions: true } } },
      take: 6,
    });
    if (families.length === 0) {
      console.log(`MISSING  ${t}`);
      continue;
    }
    for (const f of families) {
      const games = f.games
        .map(
          (g) =>
            `${g.platform?.slug}@${g.releaseDate?.toISOString().split("T")[0] ?? "null"}[${g.versions.map((v) => v.name).join("|")}]`
        )
        .join("  ");
      console.log(`"${f.title}": ${games}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
