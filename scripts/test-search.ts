/**
 * Test search functionality
 */

import { PrismaClient } from "@prisma/client";
import { searchGameFamilies } from "../src/lib/fulltext-search.js";

const prisma = new PrismaClient();

async function test() {
  const searchTerms = ["Boktai 3", "boktai3", "Sabata"];

  for (const term of searchTerms) {
    console.log(`\nSearching for "${term}"...`);
    const results = await searchGameFamilies(prisma, term, 5);
    console.log(`Found ${results.length} results`);

    if (results.length > 0) {
      const games = await prisma.gameFamily.findMany({
        where: { id: { in: results } },
        select: { title: true, searchTitle: true },
      });
      for (const game of games) {
        console.log(`  - ${game.title}`);
      }
    }
  }

  await prisma.$disconnect();
}

test().catch(console.error);
