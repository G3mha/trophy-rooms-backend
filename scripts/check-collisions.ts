import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  for (const t of ["Star Fox", "Final Fantasy VII", "Dragon Quest I", "Tomodachi"]) {
    const fams = await prisma.gameFamily.findMany({
      where: { title: { contains: t, mode: "insensitive" } },
      select: { title: true, slug: true },
    });
    console.log(t, "->", fams.map((f) => `${f.title} (${f.slug})`));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
