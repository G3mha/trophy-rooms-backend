import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const families = await prisma.gameFamily.findMany({
    where: { title: { contains: "Metroid Prime", mode: "insensitive" } },
    include: { games: { include: { platform: true, versions: true } } },
  });
  for (const f of families) {
    console.log(`Family: "${f.title}" (${f.id}) cover=${f.coverUrl ? "yes" : "no"}`);
    for (const g of f.games) {
      console.log(
        `  Game: platform=${g.platform?.slug} cover=${g.coverUrl ? "yes" : "no"} release=${g.releaseDate?.toISOString().split("T")[0]} versions=[${g.versions.map((v) => v.name).join(", ")}]`
      );
    }
  }

  const versions = await prisma.gameVersion.findMany({
    where: { OR: [{ slug: "remastered" }, { name: { contains: "Remaster", mode: "insensitive" } }] },
    select: { name: true, slug: true },
  });
  console.log("Remaster-like versions:", versions);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
