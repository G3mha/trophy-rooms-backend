import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const games = await prisma.gameFamily.findMany({
    where: {
      OR: [
        { title: { contains: "Wonder", mode: "insensitive" } },
        { title: { contains: "Mario Bros", mode: "insensitive" } }
      ]
    },
    select: { title: true, id: true }
  });

  console.log("Found:");
  games.forEach(g => console.log(`  - ${g.title}`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
