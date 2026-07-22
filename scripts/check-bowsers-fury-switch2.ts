import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const game = await prisma.game.findFirst({
    where: {
      gameFamily: { title: { equals: "Bowser's Fury", mode: "insensitive" } },
      platform: { slug: "switch-2" },
    },
    include: {
      _count: {
        select: {
          trophies: true,
          userGames: true,
          collectionItems: true,
          versions: true,
          buylistItems: true,
        },
      },
    },
  });
  if (!game) {
    console.log("No switch-2 Bowser's Fury game found");
    return;
  }
  console.log("Game:", game.id, "release:", game.releaseDate?.toISOString());
  console.log("Counts:", game._count);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
