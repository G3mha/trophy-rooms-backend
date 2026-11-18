/**
 * Check trophy awarding, completion rate, game progress and the duplicate
 * trophy and stuck Platinum cleanups end to end, through the real GraphQL
 * schema.
 *
 * It writes fixtures and runs fix-stuck-platinums.ts and
 * fix-duplicate-trophies.ts with --apply, so it only runs against an empty database on localhost. Set up a disposable one:
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

// context.ts resolves SUPABASE_URL and SUPABASE_SECRET_KEY at import. No
// token is verified here.
process.env.SUPABASE_URL ??= "http://127.0.0.1.invalid";
process.env.SUPABASE_SECRET_KEY ??= "unused";

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
  percentComplete: number;
  hasTrophy: boolean;
};

const PROGRESS_FIELDS =
  "gameFamilyId earnedCount totalCount percentComplete hasTrophy";

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

// What a visitor sees on the game page: the achievement total should match
// the trophy bar, while the set list still shows every visible set.
async function familyTotals(familyId: string) {
  const data = await run<{
    gameFamily: { totalAchievementCount: number; achievementSetCount: number } | null;
  }>(null, `query ($id: ID!) { gameFamily(id: $id) { totalAchievementCount achievementSetCount } }`, {
    id: familyId,
  });
  return data.gameFamily;
}

function runScript(name: string, ...args: string[]) {
  const script = fileURLToPath(new URL(`./${name}.ts`, import.meta.url));
  const result = spawnSync("npx", ["tsx", script, ...args], {
    env: process.env,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${name} failed:\n${result.stderr}`);
  return result.stdout;
}

const runCleanup = (...args: string[]) => runScript("fix-duplicate-trophies", ...args);
const runStuckCleanup = (...args: string[]) => runScript("fix-stuck-platinums", ...args);

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
          create: points.map((_, index) => ({ title: `${title} ${index + 1}` })),
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
    percentComplete: 1 / 3,
    hasTrophy: false,
  });

  console.log("Unmarking removes the trophy, re-marking restores it");

  await unmark(alice, firstOfficial.id);
  check("alice loses her trophy", await trophyGameIds(alice), []);
  check("alice drops to 2 of 3", (await myProgress(alice, family.id))?.percentComplete, 2 / 3);
  await mark(alice, firstOfficial.id);
  check("alice gets her trophy back on B", await trophyGameIds(alice), [gameMid.id]);

  console.log("countsTowardTrophy: a restating set neither gates nor counts");

  // A second real list for the same game, the shape Resident Evil Requiem has:
  // a console trophy list plus an in-game challenge list that restates it.
  // Flagged off, it must be invisible to trophy awarding and to progress.
  const restating = await prisma.achievementSet.create({
    data: {
      title: "A restating list",
      type: AchievementSetType.OFFICIAL,
      visibility: AchievementSetVisibility.PUBLIC,
      gameFamilyId: family.id,
      countsTowardTrophy: false,
      achievements: {
        create: [
          { title: "A restating list 1" },
          { title: "A restating list 2" },
        ],
      },
    },
    include: { achievements: { orderBy: { title: "asc" } } },
  });
  const [restatingFirst] = restating.achievements as [(typeof restating.achievements)[number]];

  check("alice keeps her trophy when a flagged-off set appears", await trophyGameIds(alice), [
    gameMid.id,
  ]);
  check(
    "alice stays at 100% with the flagged-off set present",
    await myProgress(alice, family.id),
    expectedComplete
  );

  // Ticking inside a flagged-off set must not move the bar either way
  await mark(alice, restatingFirst.id);
  check(
    "ticking a flagged-off achievement leaves progress at 3 of 3",
    await myProgress(alice, family.id),
    expectedComplete
  );
  check("alice still holds her trophy", await trophyGameIds(alice), [gameMid.id]);

  // Clients compute progress from a game's sets, so they have to see the flag
  const exposed = await run<{
    gameFamily: { achievementSets: { title: string; countsTowardTrophy: boolean }[] } | null;
  }>(
    null,
    `query ($id: ID!) { gameFamily(id: $id) { achievementSets { title countsTowardTrophy } } }`,
    { id: family.id }
  );
  check(
    "GraphQL reports the flag on the set",
    exposed.gameFamily?.achievementSets.find((set) => set.title === "A restating list")
      ?.countsTowardTrophy,
    false
  );

  // Its title sorts first, so only the flag can put it last
  const expectedSetOrder = ["Dave public", "Official", "A restating list"];
  check(
    "the family lists the set that does not gate last",
    exposed.gameFamily?.achievementSets.map((set) => set.title),
    expectedSetOrder
  );
  const onGame = await run<{ game: { achievementSets: { title: string }[] } | null }>(
    null,
    `query ($id: ID!) { game(id: $id) { achievementSets { title } } }`,
    { id: gameOld.id }
  );
  check(
    "the game page lists it last too",
    onGame.game?.achievementSets.map((set) => set.title),
    expectedSetOrder
  );

  // The public game page must not advertise a bigger total than the bar
  check(
    "the public achievement total counts gating sets only",
    (await familyTotals(family.id))?.totalAchievementCount,
    3
  );
  check(
    "while the flagged-off set still shows in the set list",
    (await familyTotals(family.id))?.achievementSetCount,
    3
  );

  // The flag is what does the work: counting the same set raises the bar
  await prisma.achievementSet.update({
    where: { id: restating.id },
    data: { countsTowardTrophy: true },
  });
  check(
    "counting the same set raises alice's total to 5",
    (await myProgress(alice, family.id))?.totalCount,
    5
  );
  check(
    "and drops her below 100%",
    (await myProgress(alice, family.id))?.percentComplete,
    4 / 5
  );
  check(
    "counting it raises the public total to 5 as well",
    (await familyTotals(family.id))?.totalAchievementCount,
    5
  );

  await prisma.achievementSet.update({
    where: { id: restating.id },
    data: { countsTowardTrophy: false },
  });
  check(
    "flagging it off again restores 100%",
    await myProgress(alice, family.id),
    expectedComplete
  );

  // Leave the family as the later checks expect to find it
  await unmark(alice, restatingFirst.id);
  await prisma.achievementSet.delete({ where: { id: restating.id } });

  console.log("Bulk-written completions stay out of the activity feed");

  // Imports write many completions at one instant; a player's own ticks never share one
  const hank = await makeUser("hank");
  await mark(hank, firstOfficial.id);
  const bulkAt = new Date();
  await prisma.userAchievement.createMany({
    data: eligible
      .filter((achievement) => achievement.id !== firstOfficial.id)
      .map((achievement) => ({ userId: hank.id, achievementId: achievement.id, createdAt: bulkAt })),
  });
  const feed = await run<{
    activityFeed: { type: string; userId: string; achievementId: string | null }[];
    recentAchievementActivity: { userId: string; achievementId: string }[];
  }>(
    null,
    `{ activityFeed(limit: 100) { type userId achievementId }
       recentAchievementActivity(limit: 50) { userId achievementId } }`
  );
  check(
    "the feed shows hank's own tick, not the bulk rows",
    feed.activityFeed
      .filter((entry) => entry.userId === hank.id && entry.type === "achievement")
      .map((entry) => entry.achievementId),
    [firstOfficial.id]
  );
  check(
    "the achievement feed shows only hank's own tick",
    feed.recentAchievementActivity.filter((entry) => entry.userId === hank.id).map((entry) => entry.achievementId),
    [firstOfficial.id]
  );
  check(
    "other players' single ticks still reach the feed",
    feed.activityFeed.some((entry) => entry.type === "achievement" && entry.userId !== hank.id),
    true
  );
  await prisma.user.delete({ where: { id: hank.id } });

  console.log("The Platinum is the trophy: derived, never counted");

  const platinum = await prisma.achievement.create({
    data: { title: "Verify Platinum", tier: "PLATINUM", achievementSetId: official.id },
  });
  const ivy = await makeUser("ivy");
  const hasPlatinum = async (user: User) =>
    (await prisma.userAchievement.count({ where: { userId: user.id, achievementId: platinum.id } })) === 1;

  check(
    "it does not raise the public total",
    (await familyTotals(family.id))?.totalAchievementCount,
    eligible.length
  );
  check(
    "it cannot be ticked by hand",
    (
      await run<{ markAchievementComplete: { success: boolean } }>(
        ivy,
        `mutation ($id: ID!) { markAchievementComplete(achievementId: $id) { success } }`,
        { id: platinum.id }
      )
    ).markAchievementComplete.success,
    false
  );
  for (const achievement of eligible.slice(0, -1)) await mark(ivy, achievement.id);
  check("one short of the list, there is no trophy", await trophyGameIds(ivy), []);
  check("and no Platinum", await hasPlatinum(ivy), false);

  const [lastEligible] = eligible.slice(-1) as [(typeof eligible)[number]];
  await mark(ivy, lastEligible.id);
  check("the last tick awards the trophy without ticking the Platinum", await trophyGameIds(ivy), [gameOld.id]);
  check("and completes the Platinum for her", await hasPlatinum(ivy), true);
  const unticked = await run<{ unmarkAchievementComplete: { success: boolean } }>(
    ivy,
    `mutation ($id: ID!) { unmarkAchievementComplete(achievementId: $id) { success } }`,
    { id: platinum.id }
  );
  check(
    "it cannot be unticked by hand, so she keeps it",
    [unticked.unmarkAchievementComplete.success, await hasPlatinum(ivy)],
    [false, true]
  );
  const ivyProgress = await myProgress(ivy, family.id);
  check("her progress counts the list, not the Platinum", [ivyProgress?.earnedCount, ivyProgress?.totalCount], [
    eligible.length,
    eligible.length,
  ]);
  check("at 100%", ivyProgress?.percentComplete, 1);
  check(
    "the Platinum is not a feed entry",
    (
      await run<{ activityFeed: { achievementId: string | null }[] }>(
        null,
        `{ activityFeed(limit: 100) { achievementId } }`
      )
    ).activityFeed.some((entry) => entry.achievementId === platinum.id),
    false
  );

  await unmark(ivy, lastEligible.id);
  check("unticking one removes the trophy", await trophyGameIds(ivy), []);
  check("and the Platinum with it", await hasPlatinum(ivy), false);

  // Leave the family as the later checks expect to find it
  await prisma.user.delete({ where: { id: ivy.id } });
  await prisma.achievement.delete({ where: { id: platinum.id } });

  console.log("fix-stuck-platinums.ts");

  // A second list that counts, with its own Platinum, next to a Platinum on
  // the official list
  const officialPlatinum = await prisma.achievement.create({
    data: { title: "Verify Platinum", tier: "PLATINUM", achievementSetId: official.id },
  });
  const second = await prisma.achievementSet.create({
    data: {
      title: "Second list",
      type: AchievementSetType.OFFICIAL,
      visibility: AchievementSetVisibility.PUBLIC,
      gameFamilyId: family.id,
      achievements: {
        create: [{ title: "Second list 1" }, { title: "Second list Platinum", tier: "PLATINUM" }],
      },
    },
    include: { achievements: { orderBy: { title: "asc" } } },
  });
  const [secondRegular, secondPlatinum] = second.achievements as [
    (typeof second.achievements)[number],
    (typeof second.achievements)[number],
  ];
  const jack = await makeUser("jack");
  const kate = await makeUser("kate");
  const holds = async (user: User, achievementId: string) =>
    (await prisma.userAchievement.count({ where: { userId: user.id, achievementId } })) === 1;

  for (const user of [jack, kate]) {
    for (const achievement of [...eligible, secondRegular]) await mark(user, achievement.id);
  }
  check(
    "finishing both lists gives jack both Platinums",
    [await holds(jack, officialPlatinum.id), await holds(jack, secondPlatinum.id)],
    [true, true]
  );

  // The list stops counting, then jack unticks a trophy in a list that does
  await prisma.achievementSet.update({ where: { id: second.id }, data: { countsTowardTrophy: false } });
  await unmark(jack, firstOfficial.id);
  check(
    "unticking takes jack's trophy and counting Platinum, but not the one in the list that stopped counting",
    [await trophyGameIds(jack), await holds(jack, officialPlatinum.id), await holds(jack, secondPlatinum.id)],
    [[], false, true]
  );

  const trophiesBeforeStuck = await prisma.trophy.count();
  const secondPlatinumRows = () =>
    prisma.userAchievement.count({ where: { achievementId: secondPlatinum.id } });
  check(
    "dry run plans jack's and kate's Platinums in that list",
    runStuckCleanup().includes("Rows to delete: 2"),
    true
  );
  check("dry run deletes nothing", await secondPlatinumRows(), 2);

  runStuckCleanup("--apply");
  check("apply removes the Platinums in the list that stopped counting", await secondPlatinumRows(), 0);
  check(
    "regular ticks in that list stay",
    await prisma.userAchievement.count({ where: { achievementId: secondRegular.id } }),
    2
  );
  check(
    "kate keeps her trophy and her Platinum in the list that counts",
    [await trophyGameIds(kate), await holds(kate, officialPlatinum.id)],
    [[gameOld.id], true]
  );
  check("no Trophy row is deleted", await prisma.trophy.count(), trophiesBeforeStuck);
  check(
    "a second run finds nothing to delete",
    runStuckCleanup("--apply").includes("Rows to delete: 0"),
    true
  );

  // Leave the family as the later checks expect to find it
  await prisma.user.deleteMany({ where: { id: { in: [jack.id, kate.id] } } });
  await prisma.achievementSet.delete({ where: { id: second.id } });
  await prisma.achievement.delete({ where: { id: officialPlatinum.id } });

  console.log("updateAchievementSet: a public custom list goes back to private");

  const listPlatinums = await Promise.all(
    [official, davePublic].map((set) =>
      prisma.achievement.create({
        data: { title: `${set.title} Platinum`, tier: "PLATINUM", achievementSetId: set.id },
      })
    )
  );
  const [officialListPlatinum, daveListPlatinum] = listPlatinums as [
    (typeof listPlatinums)[number],
    (typeof listPlatinums)[number],
  ];
  const [daveRegular] = davePublic.achievements as [(typeof davePublic.achievements)[number]];
  const liam = await makeUser("liam");
  const mona = await makeUser("mona");
  for (const achievement of eligible) await mark(liam, achievement.id);
  for (const achievement of official.achievements) await mark(mona, achievement.id);
  check(
    "liam finished both lists and holds both Platinums",
    [await holds(liam, officialListPlatinum.id), await holds(liam, daveListPlatinum.id)],
    [true, true]
  );
  check("mona is one list short, so she has no trophy", await trophyGameIds(mona), []);

  const setVisibility = async (visibility: AchievementSetVisibility) =>
    (
      await run<{ updateAchievementSet: { success: boolean } }>(
        dave,
        `mutation ($id: ID!, $input: UpdateAchievementSetInput!) {
           updateAchievementSet(id: $id, input: $input) { success }
         }`,
        { id: davePublic.id, input: { visibility } }
      )
    ).updateAchievementSet.success;
  const trophiesBeforePrivate = await prisma.trophy.count();

  check("dave makes his list private", await setVisibility(AchievementSetVisibility.PRIVATE), true);
  check("liam's Platinum in that list goes with it", await holds(liam, daveListPlatinum.id), false);
  check("his regular tick in it stays", await holds(liam, daveRegular.id), true);
  check(
    "he keeps his trophy and the Platinum in the list that counts",
    [await trophyGameIds(liam), await holds(liam, officialListPlatinum.id)],
    [[gameOld.id], true]
  );
  check(
    "mona is finished now, so she gets the trophy and the counting Platinum only",
    [
      await trophyGameIds(mona),
      await holds(mona, officialListPlatinum.id),
      await holds(mona, daveListPlatinum.id),
    ],
    [[gameOld.id], true, false]
  );
  check("mona's is the only new Trophy row", await prisma.trophy.count(), trophiesBeforePrivate + 1);
  check(
    "nothing is left for fix-stuck-platinums",
    runStuckCleanup().includes("Rows to delete: 0"),
    true
  );

  // Leave the family as the later checks expect to find it
  await prisma.achievementSet.update({
    where: { id: davePublic.id },
    data: { visibility: AchievementSetVisibility.PUBLIC },
  });
  await prisma.user.deleteMany({ where: { id: { in: [liam.id, mona.id] } } });
  await prisma.achievement.deleteMany({
    where: { id: { in: [officialListPlatinum.id, daveListPlatinum.id] } },
  });

  console.log("A family's last counting list goes private or is deleted");

  const soloFamily = await prisma.gameFamily.create({
    data: { title: "Verify Game Three", slug: "verify-game-three" },
  });
  const soloGame = await prisma.game.create({
    data: { gameFamilyId: soloFamily.id, platformId: platformD.id },
  });
  const nina = await makeUser("nina");
  const owen = await makeUser("owen");
  // A public custom list with one regular achievement and a Platinum
  const makeSoloList = async (title: string, owner: User) => {
    const list = await prisma.achievementSet.create({
      data: {
        title,
        type: AchievementSetType.CUSTOM,
        visibility: AchievementSetVisibility.PUBLIC,
        gameFamilyId: soloFamily.id,
        createdByUserId: owner.id,
        achievements: { create: [{ title: `${title} 1` }, { title: `${title} Platinum`, tier: "PLATINUM" }] },
      },
      include: { achievements: { orderBy: { title: "asc" } } },
    });
    const [regular, platinum] = list.achievements as [
      (typeof list.achievements)[number],
      (typeof list.achievements)[number],
    ];
    return { id: list.id, regular, platinum };
  };
  const deleteList = async (user: User, id: string) =>
    (
      await run<{ deleteAchievementSet: { success: boolean } }>(
        user,
        `mutation ($id: ID!) { deleteAchievementSet(id: $id) { success } }`,
        { id }
      )
    ).deleteAchievementSet.success;

  const onlyList = await makeSoloList("Only", nina);
  await mark(nina, onlyList.regular.id);
  check(
    "nina finishes the only list and gets the trophy and its Platinum",
    [await trophyGameIds(nina), await holds(nina, onlyList.platinum.id)],
    [[soloGame.id], true]
  );
  check(
    "she makes it private",
    (
      await run<{ updateAchievementSet: { success: boolean } }>(
        nina,
        `mutation ($id: ID!, $input: UpdateAchievementSetInput!) {
           updateAchievementSet(id: $id, input: $input) { success }
         }`,
        { id: onlyList.id, input: { visibility: AchievementSetVisibility.PRIVATE } }
      )
    ).updateAchievementSet.success,
    true
  );
  check(
    "nothing is left to finish, so the trophy and the Platinum go",
    [await trophyGameIds(nina), await holds(nina, onlyList.platinum.id)],
    [[], false]
  );
  check("her regular tick stays", await holds(nina, onlyList.regular.id), true);
  await prisma.achievementSet.delete({ where: { id: onlyList.id } });

  const doomed = await makeSoloList("Doomed", nina);
  await mark(nina, doomed.regular.id);
  check("nina finishes a new only list", await trophyGameIds(nina), [soloGame.id]);
  check("she deletes it", await deleteList(nina, doomed.id), true);
  check("the trophy goes with the only list", await trophyGameIds(nina), []);

  console.log("deleteAchievementSet: one of two counting lists is deleted");

  const kept = await makeSoloList("Kept", nina);
  const extra = await makeSoloList("Extra", owen);
  for (const list of [kept, extra]) await mark(nina, list.regular.id);
  await mark(owen, kept.regular.id);
  check(
    "nina finished both lists, owen is one list short",
    [await trophyGameIds(nina), await trophyGameIds(owen)],
    [[soloGame.id], []]
  );
  check("owen deletes his list", await deleteList(owen, extra.id), true);
  check(
    "nina keeps her trophy and the Platinum in the list that is left",
    [await trophyGameIds(nina), await holds(nina, kept.platinum.id)],
    [[soloGame.id], true]
  );
  check(
    "owen is finished now, so he gets the trophy and the Platinum",
    [await trophyGameIds(owen), await holds(owen, kept.platinum.id)],
    [[soloGame.id], true]
  );

  check(
    "nina deletes the last regular achievement in the list",
    (
      await run<{ deleteAchievement: { success: boolean } }>(
        nina,
        `mutation ($id: ID!) { deleteAchievement(id: $id) { success } }`,
        { id: kept.regular.id }
      )
    ).deleteAchievement.success,
    true
  );
  check(
    "nothing is left to finish, so both trophies and Platinums go",
    [
      await trophyGameIds(nina),
      await trophyGameIds(owen),
      await holds(nina, kept.platinum.id),
      await holds(owen, kept.platinum.id),
    ],
    [[], [], false, false]
  );

  console.log("updateAchievement: a counting achievement is retiered to Platinum");

  const retier = await makeSoloList("Retier", nina);
  const retierSecond = await prisma.achievement.create({
    data: { title: "Retier 2", achievementSetId: retier.id },
  });
  const makePlatinum = async (id: string) =>
    (
      await run<{ updateAchievement: { success: boolean } }>(
        nina,
        `mutation ($id: ID!, $input: UpdateAchievementInput!) {
           updateAchievement(id: $id, input: $input) { success }
         }`,
        { id, input: { tier: "PLATINUM" } }
      )
    ).updateAchievement.success;
  await mark(nina, retier.regular.id);
  await mark(nina, retierSecond.id);
  await mark(owen, retierSecond.id);
  check(
    "nina finished the list, owen ticked one of two",
    [await trophyGameIds(nina), await trophyGameIds(owen)],
    [[soloGame.id], []]
  );
  check("nina retiers the one owen ticked", await makePlatinum(retierSecond.id), true);
  check(
    "nina keeps her trophy and holds the new Platinum",
    [await trophyGameIds(nina), await holds(nina, retierSecond.id)],
    [[soloGame.id], true]
  );
  check(
    "owen has no trophy, so his tick on the new Platinum goes",
    [await trophyGameIds(owen), await holds(owen, retierSecond.id)],
    [[], false]
  );
  check("nina retiers the last regular achievement", await makePlatinum(retier.regular.id), true);
  check(
    "nothing is left to finish, so the trophy and every Platinum go",
    [
      await trophyGameIds(nina),
      await holds(nina, retier.regular.id),
      await holds(nina, retierSecond.id),
      await holds(nina, retier.platinum.id),
    ],
    [[], false, false, false]
  );
  check("fix-stuck-platinums finds nothing after the retiers", runStuckCleanup().includes("Rows to delete: 0"), true);

  console.log("setAchievementSetType: a counting list is turned custom");

  const admin = await prisma.user.create({
    data: { supabaseId: "verify-admin", email: "admin@verify.invalid", name: "admin", role: "ADMIN" },
  });
  const makeOfficialList = async (title: string) => {
    const list = await prisma.achievementSet.create({
      data: {
        title,
        type: AchievementSetType.OFFICIAL,
        visibility: AchievementSetVisibility.PUBLIC,
        gameFamilyId: soloFamily.id,
        achievements: { create: [{ title: `${title} 1` }, { title: `${title} Platinum`, tier: "PLATINUM" }] },
      },
      include: { achievements: { orderBy: { title: "asc" } } },
    });
    const [regular, platinum] = list.achievements as [
      (typeof list.achievements)[number],
      (typeof list.achievements)[number],
    ];
    return { id: list.id, regular, platinum };
  };
  const turnCustom = async (id: string) =>
    (
      await run<{ setAchievementSetType: { success: boolean } }>(
        admin,
        `mutation ($id: ID!) { setAchievementSetType(id: $id, type: CUSTOM) { success } }`,
        { id }
      )
    ).setAchievementSetType.success;
  const bulkDelete = async (field: "bulkDeleteAchievementSets" | "bulkDeleteAchievements", ids: string[]) =>
    (
      await run<Record<string, { success: boolean }>>(
        admin,
        `mutation ($ids: [ID!]!) { ${field}(ids: $ids) { success } }`,
        { ids }
      )
    )[field]?.success;
  // nina finishes both lists, owen only the first
  const twoLists = async (prefix: string) => {
    const first = await makeOfficialList(`${prefix} A`);
    const second = await makeOfficialList(`${prefix} B`);
    for (const list of [first, second]) await mark(nina, list.regular.id);
    await mark(owen, first.regular.id);
    check(
      `${prefix}: nina finished both lists, owen is one list short`,
      [await trophyGameIds(nina), await trophyGameIds(owen)],
      [[soloGame.id], []]
    );
    return [first, second] as const;
  };

  const [typeA, typeB] = await twoLists("Type");
  check("an admin turns the second list custom", await turnCustom(typeB.id), true);
  check(
    "nina keeps her trophy and loses the Platinum in the custom list",
    [await trophyGameIds(nina), await holds(nina, typeA.platinum.id), await holds(nina, typeB.platinum.id)],
    [[soloGame.id], true, false]
  );
  check(
    "owen is finished now, so he gets the trophy and the Platinum",
    [await trophyGameIds(owen), await holds(owen, typeA.platinum.id)],
    [[soloGame.id], true]
  );
  check("the admin turns the first list custom too", await turnCustom(typeA.id), true);
  check(
    "nothing is left to finish, so both trophies and Platinums go",
    [
      await trophyGameIds(nina),
      await trophyGameIds(owen),
      await holds(nina, typeA.platinum.id),
      await holds(owen, typeA.platinum.id),
    ],
    [[], [], false, false]
  );

  console.log("bulkDeleteAchievementSets: counting lists are deleted in bulk");

  const [setsA, setsB] = await twoLists("Sets");
  check("an admin bulk deletes the second list", await bulkDelete("bulkDeleteAchievementSets", [setsB.id]), true);
  check(
    "nina keeps her trophy, and owen gets it with the Platinum",
    [await trophyGameIds(nina), await trophyGameIds(owen), await holds(owen, setsA.platinum.id)],
    [[soloGame.id], [soloGame.id], true]
  );
  check("the admin bulk deletes the first list too", await bulkDelete("bulkDeleteAchievementSets", [setsA.id]), true);
  check(
    "nothing is left to finish, so both trophies go",
    [await trophyGameIds(nina), await trophyGameIds(owen)],
    [[], []]
  );

  console.log("bulkDeleteAchievements: counting achievements are deleted in bulk");

  const bulk = await makeOfficialList("Bulk");
  const bulkSecond = await prisma.achievement.create({
    data: { title: "Bulk 2", achievementSetId: bulk.id },
  });
  await mark(nina, bulk.regular.id);
  await mark(nina, bulkSecond.id);
  await mark(owen, bulk.regular.id);
  check(
    "nina finished the list, owen ticked one of two",
    [await trophyGameIds(nina), await trophyGameIds(owen)],
    [[soloGame.id], []]
  );
  check("an admin bulk deletes the one owen is missing", await bulkDelete("bulkDeleteAchievements", [bulkSecond.id]), true);
  check(
    "nina keeps her trophy, and owen gets it with the Platinum",
    [await trophyGameIds(nina), await trophyGameIds(owen), await holds(owen, bulk.platinum.id)],
    [[soloGame.id], [soloGame.id], true]
  );
  check("the admin bulk deletes the last regular achievement", await bulkDelete("bulkDeleteAchievements", [bulk.regular.id]), true);
  check(
    "nothing is left to finish, so both trophies and Platinums go",
    [
      await trophyGameIds(nina),
      await trophyGameIds(owen),
      await holds(nina, bulk.platinum.id),
      await holds(owen, bulk.platinum.id),
    ],
    [[], [], false, false]
  );
  check("fix-stuck-platinums finds nothing after the admin paths", runStuckCleanup().includes("Rows to delete: 0"), true);
  await prisma.user.delete({ where: { id: admin.id } });

  await prisma.user.deleteMany({ where: { id: { in: [nina.id, owen.id] } } });
  await prisma.gameFamily.delete({ where: { id: soloFamily.id } });

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
