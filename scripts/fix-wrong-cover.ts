import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Fix "To a T" which was incorrectly matched to Animal Crossing
  const game = await prisma.game.findFirst({
    where: {
      gameFamily: { title: "To a T" },
      platform: { slug: "switch-2" }
    }
  });

  if (game && game.coverUrl) {
    await prisma.game.update({
      where: { id: game.id },
      data: { coverUrl: null }
    });
    console.log("✅ Removed incorrect cover from 'To a T' Switch 2 entry");
  } else {
    console.log("No fix needed");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
