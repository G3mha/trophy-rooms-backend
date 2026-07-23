import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const families = await prisma.gameFamily.findMany({
    where: { title: { contains: "Sifu", mode: "insensitive" } },
    include: {
      games: { include: { platform: true, versions: true } },
      dlcs: { select: { name: true } },
    },
  });
  for (const f of families) {
    console.log(`Family: "${f.title}" (${f.id}) cover=${f.coverUrl ? "yes" : "no"} release=${f.releaseDate?.toISOString().split("T")[0]}`);
    for (const g of f.games) {
      console.log(
        `  Game: platform=${g.platform?.slug} cover=${g.coverUrl ? "yes" : "no"} release=${g.releaseDate?.toISOString().split("T")[0]} versions=[${g.versions.map((v) => v.name).join(", ")}]`
      );
    }
    console.log(`  DLCs: [${f.dlcs.map((d) => d.name).join(", ")}]`);
  }
  if (families.length === 0) console.log("No Sifu family found");

  const versions = await prisma.gameVersion.findMany({
    where: {
      OR: [
        { slug: { contains: "vengeance" } },
        { slug: { contains: "redemption" } },
      ],
    },
    select: { name: true, slug: true },
  });
  console.log("Edition versions:", versions);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
