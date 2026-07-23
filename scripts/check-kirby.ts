import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const gf = await prisma.gameFamily.findFirst({
    where: { title: "Kirby and the Forgotten Land" },
    include: {
      games: {
        include: {
          platform: { select: { name: true } },
          versions: { select: { name: true } }
        }
      }
    }
  });

  if (gf) {
    console.log(`${gf.title}\n`);
    for (const g of gf.games) {
      const versions = g.versions.map(v => v.name).join(", ") || "Standard";
      console.log(`  ${g.platform?.name}: ${versions}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
