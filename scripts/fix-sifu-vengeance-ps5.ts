/**
 * Link the Vengeance Edition version to the PS5 Sifu game.
 *
 * The Vengeance Edition also released physically on PS4/PS5 (2022-05-03,
 * Microids); the DB tracks Sifu on PS5, so the shared version connects there
 * too. The version's releaseDate stays the Switch date - GameVersion has a
 * single date field and the edition is shared across platforms.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Link Vengeance Edition to Sifu on PS5 ===\n");

  const ps5Game = await prisma.game.findFirst({
    where: {
      gameFamily: { title: { equals: "Sifu", mode: "insensitive" } },
      platform: { slug: "ps5" },
    },
    include: { versions: { select: { slug: true } } },
  });
  if (!ps5Game) {
    console.error("Sifu PS5 game entry not found");
    return;
  }

  if (ps5Game.versions.some((v) => v.slug === "vengeance-edition")) {
    console.log("Already linked - nothing to do");
    return;
  }

  const version = await prisma.gameVersion.findUnique({
    where: { slug: "vengeance-edition" },
  });
  if (!version) {
    console.error("Vengeance Edition version not found");
    return;
  }

  await prisma.game.update({
    where: { id: ps5Game.id },
    data: { versions: { connect: [{ id: version.id }] } },
  });
  console.log(`Linked ${version.name} to the PS5 game (${ps5Game.id})`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
