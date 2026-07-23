/**
 * Set per-platform release dates for the Sifu Vengeance Edition:
 * PS5 2022-05-03 (Microids physical launch), Switch 2022-11-08.
 * Also sets the version's canonical releaseDate to the earliest (PS5).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DATES: Array<{ platformSlug: string; releaseDate: Date }> = [
  { platformSlug: "ps5", releaseDate: new Date("2022-05-03") },
  { platformSlug: "switch", releaseDate: new Date("2022-11-08") },
];

async function main() {
  console.log("=== Set Sifu Vengeance Edition per-platform dates ===\n");

  const version = await prisma.gameVersion.findUnique({
    where: { slug: "vengeance-edition" },
  });
  if (!version) {
    console.error("Vengeance Edition version not found");
    return;
  }

  for (const { platformSlug, releaseDate } of DATES) {
    const game = await prisma.game.findFirst({
      where: {
        gameFamily: { title: { equals: "Sifu", mode: "insensitive" } },
        platform: { slug: platformSlug },
      },
    });
    if (!game) {
      console.error(`Sifu ${platformSlug} game not found`);
      continue;
    }

    await prisma.gameVersionReleaseDate.upsert({
      where: {
        gameId_gameVersionId: { gameId: game.id, gameVersionId: version.id },
      },
      update: { releaseDate },
      create: { gameId: game.id, gameVersionId: version.id, releaseDate },
    });
    console.log(`${platformSlug}: ${releaseDate.toISOString().split("T")[0]}`);
  }

  // Canonical date = earliest release (PS5)
  await prisma.gameVersion.update({
    where: { id: version.id },
    data: { releaseDate: new Date("2022-05-03") },
  });
  console.log("Canonical version date set to 2022-05-03");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
