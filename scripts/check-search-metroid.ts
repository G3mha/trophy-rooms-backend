import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const results = await prisma.$queryRaw<{ id: string; title: string; sim: number }[]>`
    SELECT id, title, similarity(title, 'Metroid') AS sim
    FROM "GameFamily"
    WHERE similarity(title, 'Metroid') > 0.1
       OR LOWER(title) LIKE '%metroid%'
       OR "searchTitle" LIKE '%metroid%'
    ORDER BY
      CASE WHEN "searchTitle" LIKE '%metroid%' THEN 0 ELSE 1 END,
      similarity(title, 'Metroid') DESC,
      title ASC
  `;
  results.forEach((r, i) => console.log(`${i + 1}. ${r.title} (${r.sim.toFixed(3)})`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
