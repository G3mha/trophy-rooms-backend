import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const families = await prisma.gameFamily.findMany({
    where: {
      OR: [
        { title: { contains: "Resident Evil 7", mode: "insensitive" } },
        { title: { contains: "Resident Evil Village", mode: "insensitive" } },
        { title: { contains: "Resident Evil Requiem", mode: "insensitive" } },
        { title: { contains: "Resident Evil 9", mode: "insensitive" } },
        { title: { contains: "biohazard", mode: "insensitive" } },
      ],
    },
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
  if (families.length === 0) console.log("No matching families");

  const platforms = await prisma.platform.findMany({
    where: { slug: { in: ["pc", "windows", "steam", "switch-2", "ps5", "xbox-series"] } },
    select: { slug: true, name: true },
  });
  console.log("Relevant platforms:", platforms);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
