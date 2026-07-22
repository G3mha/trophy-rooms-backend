import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const families = await prisma.gameFamily.findMany({
    where: { title: { contains: "Galaxy", mode: "insensitive" } },
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

  const wii = await prisma.platform.findUnique({ where: { slug: "wii" }, select: { slug: true, name: true } });
  console.log("Wii platform:", wii ?? "missing");

  const bundles = await prisma.bundle.findMany({
    where: { name: { contains: "Galaxy", mode: "insensitive" } },
  });
  console.log("Existing bundles:", bundles.map((b) => b.name));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
