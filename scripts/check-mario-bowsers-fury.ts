import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const families = await prisma.gameFamily.findMany({
    where: {
      OR: [
        { title: { contains: "3D World", mode: "insensitive" } },
        { title: { contains: "Bowser", mode: "insensitive" } },
      ],
    },
    include: { games: { include: { platform: true } } },
  });
  for (const f of families) {
    console.log(`Family: "${f.title}" (${f.id}) cover=${f.coverUrl ? "yes" : "no"}`);
    for (const g of f.games) {
      console.log(
        `  Game: platform=${g.platform?.slug} cover=${g.coverUrl ? "yes" : "no"} release=${g.releaseDate?.toISOString().split("T")[0]}`
      );
    }
  }

  const platforms = await prisma.platform.findMany({
    where: { slug: { contains: "switch" } },
    select: { slug: true, name: true },
  });
  console.log("Platforms:", platforms);

  const bundles = await prisma.bundle.findMany({
    where: { name: { contains: "3D World", mode: "insensitive" } },
  });
  console.log("Existing bundles:", bundles.map((b) => b.name));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
