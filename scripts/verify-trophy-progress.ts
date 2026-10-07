/**
 * Check trophy awarding, completion rate, game progress and the duplicate
 * trophy cleanup end to end, through the real GraphQL schema.
 *
 * It writes fixtures and runs fix-duplicate-trophies.ts --apply, so it only
 * runs against an empty database on localhost. Set up a disposable one:
 *
 *   initdb -D /tmp/trophy-verify -U postgres --auth=trust
 *   pg_ctl -D /tmp/trophy-verify -o "-p 5499" -w start
 *   createdb -h 127.0.0.1 -p 5499 -U postgres trophy_verify
 *   export DATABASE_URL=postgresql://postgres@127.0.0.1:5499/trophy_verify
 *   export DIRECT_URL=$DATABASE_URL
 *   npx prisma db push --skip-generate
 *   npx tsx scripts/verify-trophy-progress.ts
 *
 * Exits non-zero if any check fails. Fixtures are deleted afterwards, so it
 * can be rerun against the same database.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  AchievementSetType,
  AchievementSetVisibility,
  GameStatus,
  type User,
} from "@prisma/client";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !LOCAL_HOSTS.has(new URL(databaseUrl).hostname)) {
  console.error(
    "Set DATABASE_URL to a disposable database on localhost. This script writes fixtures and deletes trophies."
  );
  process.exit(1);
}

// context.ts resolves SUPABASE_URL at import. No token is verified here.
process.env.SUPABASE_URL ??= "http://127.0.0.1.invalid";

const { graphql } = await import("graphql");
const { schema } = await import("../src/schema/index.js");
const { prisma } = await import("../src/lib/prisma.js");

const failures: string[] = [];
let passed = 0;

function check(name: string, actual: unknown, expected: unknown) {
  try {
    assert.deepStrictEqual(actual, expected);
    passed++;
    console.log(`  PASS ${name}`);
  } catch {
    failures.push(name);
    console.log(`  FAIL ${name}`);
    console.log(`       expected ${JSON.stringify(expected)}`);
    console.log(`       actual   ${JSON.stringify(actual)}`);
  }
}

async function run<T>(user: User | null, source: string, variables?: Record<string, unknown>) {
  const result = await graphql({
    schema,
    source,
    variableValues: variables,
    contextValue: { prisma, user, authUserId: null },
  });
  if (result.errors?.length) {
    throw new Error(result.errors.map((error) => error.message).join("\n"));
  }
  // graphql-js builds null-prototype objects, which deepStrictEqual rejects
  return JSON.parse(JSON.stringify(result.data)) as T;
}

async function mark(user: User, achievementId: string) {
  const data = await run<{ markAchievementComplete: { success: boolean } }>(
    user,
    `mutation ($id: ID!) { markAchievementComplete(achievementId: $id) { success } }`,
    { id: achievementId }
  );
  assert.ok(data.markAchievementComplete.success, `mark ${achievementId} failed`);
}

async function unmark(user: User, achievementId: string) {
  const data = await run<{ unmarkAchievementComplete: { success: boolean } }>(
    user,
    `mutation ($id: ID!) { unmarkAchievementComplete(achievementId: $id) { success } }`,
    { id: achievementId }
  );
  assert.ok(data.unmarkAchievementComplete.success, `unmark ${achievementId} failed`);
}

async function trophyGameIds(user: User) {
  const trophies = await prisma.trophy.findMany({
    where: { userId: user.id },
    select: { gameId: true },
  });
  return trophies.map((trophy) => trophy.gameId).sort();
}

async function completionRate(user: User) {
  const data = await run<{ user: { stats: { completionRate: number } } }>(
    null,
    `query ($id: ID!) { user(id: $id) { stats { completionRate } } }`,
    { id: user.id }
  );
  return data.user.stats.completionRate;
}

type Progress = {
  gameFamilyId: string;
  earnedCount: number;
  totalCount: number;
  earnedPoints: number;
  totalPoints: number;
  percentComplete: number;
  hasTrophy: boolean;
};

const PROGRESS_FIELDS =
  "gameFamilyId earnedCount totalCount earnedPoints totalPoints percentComplete hasTrophy";

async function myProgress(user: User, familyId: string) {
  const data = await run<{ myGameProgress: Progress[] }>(
    user,
    `{ myGameProgress { ${PROGRESS_FIELDS} } }`
  );
  return data.myGameProgress.find((entry) => entry.gameFamilyId === familyId);
}

async function publicProgress(user: User, familyId: string) {
  const data = await run<{ userGameProgress: Progress[] }>(
    null,
    `query ($id: String!) { userGameProgress(userId: $id) { ${PROGRESS_FIELDS} } }`,
    { id: user.id }
  );
  return data.userGameProgress.find((entry) => entry.gameFamilyId === familyId);
}

function runCleanup(...args: string[]) {
  const script = fileURLToPath(new URL("./fix-duplicate-trophies.ts", import.meta.url));
  const result = spawnSync("npx", ["tsx", script, ...args], {
    env: process.env,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `fix-duplicate-trophies failed:\n${result.stderr}`);
  return result.stdout;
}

async function main() {
  if ((await prisma.user.count()) > 0) {
    console.error("Database has users. Run this against an empty, disposable database.");
    process.exitCode = 1;
    return;
  }

  try {
    await verify();
  } finally {
    await prisma.gameFamily.deleteMany({ where: { slug: { startsWith: "verify-game" } } });
    await prisma.platform.deleteMany({ where: { slug: { startsWith: "verify-platform-" } } });
    await prisma.user.deleteMany({ where: { supabaseId: { startsWith: "verify-" } } });
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exitCode = 1;
}

async function verify() {
  const platforms = await Promise.all(
    ["A", "B", "C", "D"].map((suffix) =>
      prisma.platform.create({
        data: { name: `Verify Platform ${suffix}`, slug: `verify-platform-${suffix.toLowerCase()}` },
      })
    )
  );
  const [platformA, platformB, platformC, platformD] = platforms as [
    (typeof platforms)[number],
    (typeof platforms)[number],
    (typeof platforms)[number],
    (typeof platforms)[number],
  ];

  const family = await prisma.gameFamily.create({
    data: { title: "Verify Game", slug: "verify-game" },
  });
  const otherFamily = await prisma.gameFamily.create({
    data: { title: "Verify Game Two", slug: "verify-game-two" },
  });

  // Released on three platforms, out of creation order, so the earliest
  // release is not simply the first row
  const gameMid = await prisma.game.create({
    data: { gameFamilyId: family.id, platformId: platformB.id, releaseDate: new Date("2019-01-01") },
  });
  const gameOld = await prisma.game.create({
    data: { gameFamilyId: family.id, platformId: platformA.id, releaseDate: new Date("2017-01-01") },
  });
  const gameNew = await prisma.game.create({
    data: { gameFamilyId: family.id, platformId: platformC.id, releaseDate: new Date("2021-01-01") },
  });
  const otherGame = await prisma.game.create({
    data: { gameFamilyId: otherFamily.id, platformId: platformD.id },
  });

  const makeUser = (name: string) =>
    prisma.user.create({
      data: { supabaseId: `verify-${name}`, email: `${name}@verify.invalid`, name },
    });
  const [alice, bob, carol, dave, erin, frank, gina] = (await Promise.all(
    ["alice", "bob", "carol", "dave", "erin", "frank", "gina"].map(makeUser)
  )) as [User, User, User, User, User, User, User];

  const makeSet = (
    title: string,
    type: AchievementSetType,
    visibility: AchievementSetVisibility,
    createdBy: User | null,
    points: number[]
  ) =>
    prisma.achievementSet.create({
      data: {
        title,
        type,
        visibility,
        gameFamilyId: family.id,
        createdByUserId: createdBy?.id ?? null,
        achievements: {
          create: points.map((value, index) => ({ title: `${title} ${index + 1}`, points: value })),
        },
      },
      include: { achievements: { orderBy: { title: "asc" } } },
    });

  const official = await makeSet("Official", AchievementSetType.OFFICIAL, AchievementSetVisibility.PUBLIC, null, [10, 20]);
  const davePublic = await makeSet("Dave public", AchievementSetType.CUSTOM, AchievementSetVisibility.PUBLIC, dave, [5]);
  // Another user's private set: must not count towards anyone's trophy or progress
  await makeSet("Dave private", AchievementSetType.CUSTOM, AchievementSetVisibility.PRIVATE, dave, [1, 1, 1]);
  const alicePrivate = await makeSet("Alice private", AchievementSetType.CUSTOM, AchievementSetVisibility.PRIVATE, alice, [50]);

  const eligible = [...official.achievements, ...davePublic.achievements];
  const [firstOfficial] = official.achievements as [(typeof official.achievements)[number]];

  await prisma.userGame.createMany({
    data: [
      { userId: alice.id, gameId: gameMid.id, status: GameStatus.PLAYING },
      { userId: carol.id, gameId: gameOld.id, status: GameStatus.COMPLETED },
      { userId: carol.id, gameId: gameNew.id, status: GameStatus.COMPLETED },
      { userId: frank.id, gameId: gameNew.id, status: GameStatus.COMPLETED },
    ],
  });

  console.log("Bug 1: trophies go on library editions only");

  for (const achievement of [...eligible, ...alicePrivate.achievements]) {
    await mark(alice, achievement.id);
  }
  check("alice (library: B) gets one trophy, on B", await trophyGameIds(alice), [gameMid.id]);

  for (const achievement of eligible) await mark(bob, achievement.id);
  check("bob (no library) gets one trophy, on the earliest release", await trophyGameIds(bob), [gameOld.id]);

  for (const achievement of eligible) await mark(carol, achievement.id);
  check("carol (library: A and C) gets trophies on A and C", await trophyGameIds(carol), [gameOld.id, gameNew.id].sort());

  const leaderboard = await run<{ leaderboardByTrophies: Array<{ userId: string; value: number }> }>(
    null,
    `{ leaderboardByTrophies(limit: 100) { userId value } }`
  );
  const leaderboardValue = (user: User) =>
    leaderboard.leaderboardByTrophies.find((entry) => entry.userId === user.id)?.value;
  check("leaderboard counts bob once, not once per platform", leaderboardValue(bob), 1);

  console.log("Trophy counts are finished games, not trophy rows");

  check("leaderboard counts carol's two library editions as one game", leaderboardValue(carol), 1);
  const carolCounts = await run<{ user: { trophyCount: number }; myStats: { totalTrophies: number } }>(
    carol,
    `query ($id: ID!) { user(id: $id) { trophyCount } myStats { totalTrophies } }`,
    { id: carol.id }
  );
  check("carol's trophyCount is 1 with two library editions", carolCounts.user.trophyCount, 1);
  check("carol's myStats.totalTrophies is 1 with two library editions", carolCounts.myStats.totalTrophies, 1);
  const familyCounts = await run<{ gameFamily: { totalTrophyCount: number } }>(
    null,
    `query ($id: ID!) { gameFamily(id: $id) { totalTrophyCount } }`,
    { id: family.id }
  );
  check("the family's totalTrophyCount is 3 players, not 4 trophy rows", familyCounts.gameFamily.totalTrophyCount, 3);

  check("alice completionRate is 100", await completionRate(alice), 100);
  check("carol completionRate is 100 with two library editions", await completionRate(carol), 100);
  // A trophy on a family carol never played (e.g. its achievements were deleted)
  await prisma.trophy.create({ data: { userId: carol.id, gameId: otherGame.id } });
  check("carol completionRate stays 100 with a trophy outside played families", await completionRate(carol), 100);

  console.log("Bug 2: progress uses the same sets as trophy awarding");

  const expectedComplete = {
    gameFamilyId: family.id,
    earnedCount: 3,
    totalCount: 3,
    earnedPoints: 35,
    totalPoints: 35,
    percentComplete: 1,
    hasTrophy: true,
  };
  check(
    "alice is at 100% despite dave's private set and her own private achievement",
    await myProgress(alice, family.id),
    expectedComplete
  );
  check("bob's public progress is 100%", await publicProgress(bob, family.id), expectedComplete);

  await mark(erin, firstOfficial.id);
  check("erin's partial progress is 1 of 3", await myProgress(erin, family.id), {
    gameFamilyId: family.id,
    earnedCount: 1,
    totalCount: 3,
    earnedPoints: 10,
    totalPoints: 35,
    percentComplete: 1 / 3,
    hasTrophy: false,
  });

  console.log("Unmarking removes the trophy, re-marking restores it");

  await unmark(alice, firstOfficial.id);
  check("alice loses her trophy", await trophyGameIds(alice), []);
  check("alice drops to 2 of 3", (await myProgress(alice, family.id))?.percentComplete, 2 / 3);
  await mark(alice, firstOfficial.id);
  check("alice gets her trophy back on B", await trophyGameIds(alice), [gameMid.id]);

  console.log("fix-duplicate-trophies.ts");

  // Rows the old mutation left behind: one trophy per game in the family
  await prisma.trophy.createMany({
    data: [
      { userId: frank.id, gameId: gameOld.id },
      { userId: frank.id, gameId: gameMid.id },
      { userId: frank.id, gameId: gameNew.id },
      // gina has no library entry, and no trophy on the earliest release
      { userId: gina.id, gameId: gameMid.id },
      { userId: gina.id, gameId: gameNew.id },
    ],
  });
  const before = await prisma.trophy.count();

  const dryRun = runCleanup();
  check("dry run plans two deletions for frank and one for gina", dryRun.includes("Rows to delete: 3"), true);
  check("dry run deletes nothing", await prisma.trophy.count(), before);

  runCleanup("--apply");
  check("frank keeps only his library edition", await trophyGameIds(frank), [gameNew.id]);
  check("gina keeps the earliest release she has a trophy on", await trophyGameIds(gina), [gameMid.id]);
  check("carol keeps both library editions", await trophyGameIds(carol), [gameOld.id, gameNew.id, otherGame.id].sort());
  check("bob's single trophy is untouched", await trophyGameIds(bob), [gameOld.id]);
  check("alice's single trophy is untouched", await trophyGameIds(alice), [gameMid.id]);
  check("a second run finds nothing to delete", runCleanup("--apply").includes("Rows to delete: 0"), true);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
