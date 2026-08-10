/**
 * Seeds the App Review demo account (appreview@trophyrooms.org) with a
 * realistic slice of data - collection, library, play journal, buylist,
 * and a couple of trophies - so reviewers and store screenshots don't
 * land on empty states.
 *
 * Idempotent: wipes and re-creates the demo user's own rows only.
 *
 * Usage: npx tsx scripts/seed-demo-account.ts
 */

import { PrismaClient, GameStatus, BuylistPriority } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_SUPABASE_ID = "9de0439a-f714-47f2-996a-1ba281b282e0";
const DEMO_EMAIL = "appreview@trophyrooms.org";

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

async function main() {
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { supabaseId: DEMO_SUPABASE_ID },
    create: {
      supabaseId: DEMO_SUPABASE_ID,
      email: DEMO_EMAIL,
      name: "App Review",
    },
  });

  // Reset previous seed runs
  await prisma.playSession.deleteMany({ where: { userId: user.id } });
  await prisma.trophy.deleteMany({ where: { userId: user.id } });
  await prisma.buylistItem.deleteMany({ where: { userId: user.id } });
  await prisma.collectionItem.deleteMany({ where: { userId: user.id } });
  await prisma.userGame.deleteMany({ where: { userId: user.id } });

  // Recognizable titles make for far better screenshots than whatever
  // sorts first alphabetically
  const WANTED_TITLES = [
    "The Legend of Zelda: Tears of the Kingdom",
    "The Legend of Zelda: Breath of the Wild",
    "Super Mario Odyssey",
    "Elden Ring",
    "God of War",
    "Hollow Knight",
    "Metroid Dread",
    "Hades",
    "Red Dead Redemption 2",
    "The Witcher 3: Wild Hunt",
    "Celeste",
    "Silksong",
    "Mario Kart 8",
    "Stardew Valley",
    "Bloodborne",
    "Ghost of Tsushima",
    "Super Metroid",
    "Chrono Trigger",
  ];

  const games = await prisma.game.findMany({
    where: {
      OR: WANTED_TITLES.map((t) => ({
        gameFamily: { title: { contains: t, mode: "insensitive" as const } },
      })),
    },
    include: { gameFamily: true, platform: true },
  });

  // One game per family, ordered by the curated list
  const seen = new Set<string>();
  const picks: typeof games = [];
  for (const title of WANTED_TITLES) {
    const game = games.find(
      (g) =>
        !seen.has(g.gameFamilyId) &&
        g.gameFamily.title.toLowerCase().includes(title.toLowerCase())
    );
    if (!game) continue;
    seen.add(game.gameFamilyId);
    picks.push(game);
    if (picks.length === 12) break;
  }

  if (picks.length < 12) {
    throw new Error(`Only ${picks.length} of the wanted titles found - aborting`);
  }

  const statuses: GameStatus[] = [
    GameStatus.PLAYING,
    GameStatus.PLAYING,
    GameStatus.COMPLETED,
    GameStatus.COMPLETED,
    GameStatus.COMPLETED,
    GameStatus.BACKLOG,
    GameStatus.BACKLOG,
    GameStatus.BACKLOG,
    GameStatus.PAUSED,
    GameStatus.BACKLOG,
  ];

  for (const [i, game] of picks.entries()) {
    // Library entry for the first 10
    if (i < statuses.length) {
      await prisma.userGame.create({
        data: {
          userId: user.id,
          gameId: game.id,
          platformId: game.platformId,
          status: statuses[i],
        },
      });
    }

    // Physical collection copy for 8 of them
    if (i < 8) {
      await prisma.collectionItem.create({
        data: {
          userId: user.id,
          gameId: game.id,
          platformId: game.platformId,
          hasDisc: true,
          hasBox: true,
          hasManual: i % 3 === 0,
        },
      });
    }
  }

  // Trophies on the completed games
  const completed = picks.slice(2, 5);
  for (const game of completed) {
    await prisma.trophy.create({
      data: { userId: user.id, gameId: game.id },
    });
  }

  // Play journal: an active streak over the last four days
  const playing = picks.slice(0, 2);
  const sessions = [
    { game: playing[0], day: 0, minutes: 45 },
    { game: playing[1], day: 1, minutes: 90 },
    { game: playing[0], day: 2, minutes: 30 },
    { game: playing[0], day: 3, minutes: 60 },
  ];
  for (const s of sessions) {
    await prisma.playSession.create({
      data: {
        userId: user.id,
        gameId: s.game.id,
        playedOn: daysAgo(s.day),
        minutes: s.minutes,
      },
    });
  }

  // A short buylist
  for (const game of picks.slice(9, 12)) {
    await prisma.buylistItem.create({
      data: {
        userId: user.id,
        gameId: game.id,
        priority: BuylistPriority.HIGH,
      },
    });
  }

  console.log(`Seeded demo account ${user.id}:`);
  console.log(`  library ${statuses.length}, collection 8, trophies 3, sessions 4, buylist 3`);
  console.log(picks.map((g) => `  - ${g.gameFamily.title} [${g.platform.name}]`).join("\n"));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
