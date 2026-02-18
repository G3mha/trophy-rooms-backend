import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Known legitimate games with short/unusual names
const LEGITIMATE_GAMES = new Set([
  "VVVVVV",
  "Fe",
  "Go",
  "Ib",
  "QV",
  "Up",
  "In",
  "Ro",
  "MM",
  "Q",
  "X",
  "V4",
  "A",
  "Z",
  "O", // Could be a real game
  "Y", // Could be a real game
]);

// Patterns that indicate suspicious/shovelware titles
function isSuspiciousTitle(title: string): { suspicious: boolean; reason: string } {
  // Remove whitespace for checking
  const trimmed = title.trim();

  // Skip known legitimate games
  if (LEGITIMATE_GAMES.has(trimmed)) {
    return { suspicious: false, reason: "" };
  }

  // Single character titles (except known ones)
  if (trimmed.length === 1) {
    return { suspicious: true, reason: "Single character" };
  }

  // Only symbols/punctuation (no letters or numbers)
  // Allow: Latin, CJK, Japanese, Korean, Cyrillic, Greek, Arabic, Hebrew
  if (!/[a-zA-Z0-9\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u0400-\u04ff\u0370-\u03ff\u0600-\u06ff\u0590-\u05ff]/.test(trimmed)) {
    return { suspicious: true, reason: "No alphanumeric characters" };
  }

  // Only underscores, dashes, or dots
  if (/^[_\-\.]+$/.test(trimmed)) {
    return { suspicious: true, reason: "Only underscores/dashes/dots" };
  }

  // Multiple underscores only (like _____)
  if (/^_+$/.test(trimmed)) {
    return { suspicious: true, reason: "Only underscores" };
  }

  // Repeated single non-letter character (like "0000", "----")
  if (/^([^a-zA-Z])\1+$/.test(trimmed)) {
    return { suspicious: true, reason: "Repeated single non-letter character" };
  }

  // Starts with multiple underscores followed by nothing meaningful
  if (/^_{3,}/.test(trimmed) && trimmed.length < 10) {
    return { suspicious: true, reason: "Starts with many underscores" };
  }

  return { suspicious: false, reason: "" };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  console.log("=== Weird Titles Cleanup ===\n");
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}\n`);

  // Get all games
  const games = await prisma.game.findMany({
    select: { id: true, title: true },
  });

  console.log(`Total games: ${games.length}\n`);

  const suspiciousGames: { id: string; title: string; reason: string }[] = [];

  for (const game of games) {
    const { suspicious, reason } = isSuspiciousTitle(game.title);
    if (suspicious) {
      suspiciousGames.push({ id: game.id, title: game.title, reason });
    }
  }

  console.log(`Found ${suspiciousGames.length} games with suspicious titles:\n`);

  // Show first 30 examples
  const examples = suspiciousGames.slice(0, 30);
  for (const game of examples) {
    console.log(`  "${game.title}" - ${game.reason}`);
  }

  if (suspiciousGames.length > 30) {
    console.log(`  ... and ${suspiciousGames.length - 30} more`);
  }

  if (!dryRun && suspiciousGames.length > 0) {
    console.log(`\nDeleting ${suspiciousGames.length} games...`);

    const ids = suspiciousGames.map((g) => g.id);

    // Delete in batches
    for (let i = 0; i < ids.length; i += 1000) {
      const batch = ids.slice(i, i + 1000);
      await prisma.game.deleteMany({
        where: { id: { in: batch } },
      });
      console.log(`  Deleted ${Math.min(i + 1000, ids.length)}/${ids.length}`);
    }

    console.log("\nDeletion complete!");
  } else if (dryRun) {
    console.log("\n[DRY RUN] No games deleted. Run without --dry-run to delete.");
  }

  const finalCount = await prisma.game.count();
  console.log(`\nFinal game count: ${finalCount}`);

  await prisma.$disconnect();
}

main().catch(console.error);
