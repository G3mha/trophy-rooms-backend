import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const platforms = await prisma.platform.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" }
  });

  console.log("\n=== Games by Platform ===\n");

  const results: { name: string; count: number }[] = [];

  for (const p of platforms) {
    const count = await prisma.game.count({ where: { platformId: p.id } });
    if (count > 0) {
      results.push({ name: p.name, count });
    }
  }

  // Sort by count descending
  results.sort((a, b) => b.count - a.count);

  let total = 0;
  for (const r of results) {
    console.log(`${r.name.padEnd(25)} ${r.count.toString().padStart(7)}`);
    total += r.count;
  }

  console.log("─".repeat(33));
  console.log(`${"TOTAL".padEnd(25)} ${total.toString().padStart(7)}`);

  await prisma.$disconnect();
}
main();
