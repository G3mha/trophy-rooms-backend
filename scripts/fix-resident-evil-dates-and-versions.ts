/**
 * Fix Resident Evil 7 / Village / Requiem platform data:
 *
 * - Set missing release dates on every platform Game (RE7 2017-01-24
 *   originals, 2022-06-13 next-gen, 2022-12-16 Switch Cloud, 2024-07-02
 *   iOS/macOS; Village 2021-05-07 launch, 2022-10-28 Switch Cloud/macOS,
 *   2023-10-30 iOS; all three on Switch 2 day-and-date 2026-02-27)
 * - Village on Switch is the Cloud Version, and on Switch 2 Capcom ships
 *   the Gold Edition (Winters' Expansion + Trauma Pack) - relink versions
 * - Record per-platform version dates via GameVersionReleaseDate for the
 *   shared Cloud Version and the Switch 2 Gold Editions
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SWITCH2_DATE = new Date("2026-02-27");

const GAME_DATES: Record<string, Record<string, string>> = {
  "Resident Evil 7: Biohazard": {
    ps4: "2017-01-24",
    "xbox-one": "2017-01-24",
    steam: "2017-01-24",
    ps5: "2022-06-13",
    "xbox-series": "2022-06-13",
    switch: "2022-12-16",
    ios: "2024-07-02",
    macos: "2024-07-02",
    "switch-2": "2026-02-27",
  },
  "Resident Evil Village": {
    ps4: "2021-05-07",
    ps5: "2021-05-07",
    "xbox-one": "2021-05-07",
    "xbox-series": "2021-05-07",
    steam: "2021-05-07",
    switch: "2022-10-28",
    macos: "2022-10-28",
    ios: "2023-10-30",
    "switch-2": "2026-02-27",
  },
  "Resident Evil Requiem": {
    ps5: "2026-02-27",
    "xbox-series": "2026-02-27",
    steam: "2026-02-27",
    "switch-2": "2026-02-27",
  },
};

async function findVersion(slug: string, name: string) {
  return (
    (await prisma.gameVersion.findUnique({ where: { slug } })) ??
    (await prisma.gameVersion.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    }))
  );
}

async function main() {
  console.log("=== Fix Resident Evil dates and versions ===\n");

  for (const [familyTitle, platformDates] of Object.entries(GAME_DATES)) {
    const family = await prisma.gameFamily.findFirst({
      where: { title: { equals: familyTitle, mode: "insensitive" } },
      include: { games: { include: { platform: true } } },
    });
    if (!family) {
      console.error(`Family not found: ${familyTitle}`);
      continue;
    }
    console.log(`\n${family.title}:`);

    for (const game of family.games) {
      const slug = game.platform?.slug;
      const dateString = slug ? platformDates[slug] : undefined;
      if (!dateString) {
        if (slug) console.log(`  ${slug}: no date mapped, skipped`);
        continue;
      }
      const date = new Date(dateString);
      if (game.releaseDate?.getTime() === date.getTime()) {
        console.log(`  ${slug}: already ${dateString}`);
        continue;
      }
      await prisma.game.update({
        where: { id: game.id },
        data: { releaseDate: date },
      });
      console.log(`  ${slug}: set ${dateString}`);
    }
  }

  // Village on Switch is the Cloud Version; on Switch 2 it is the Gold Edition
  const cloudVersion = await findVersion("cloud-version", "Cloud Version");
  const goldVersion = await findVersion("gold-edition", "Gold Edition");
  const standardVersion = await findVersion("standard", "Standard");

  const village = await prisma.gameFamily.findFirst({
    where: { title: { equals: "Resident Evil Village", mode: "insensitive" } },
    include: { games: { include: { platform: true, versions: true } } },
  });
  const re7 = await prisma.gameFamily.findFirst({
    where: { title: { equals: "Resident Evil 7: Biohazard", mode: "insensitive" } },
    include: { games: { include: { platform: true } } },
  });

  async function relink(
    game: { id: string; versions: { id: string }[] } | undefined,
    label: string,
    toVersion: { id: string; name: string } | null,
    fromVersion: { id: string } | null
  ) {
    if (!game || !toVersion) return;
    const hasTarget = game.versions.some((v) => v.id === toVersion.id);
    if (!hasTarget) {
      await prisma.game.update({
        where: { id: game.id },
        data: {
          versions: {
            connect: [{ id: toVersion.id }],
            ...(fromVersion ? { disconnect: [{ id: fromVersion.id }] } : {}),
          },
        },
      });
      console.log(`\n${label}: relinked to ${toVersion.name}`);
    }
  }

  const villageSwitch = village?.games.find((g) => g.platform?.slug === "switch");
  const villageSwitch2 = village?.games.find((g) => g.platform?.slug === "switch-2");
  const re7Switch = re7?.games.find((g) => g.platform?.slug === "switch");
  const re7Switch2 = re7?.games.find((g) => g.platform?.slug === "switch-2");

  await relink(villageSwitch, "Village switch", cloudVersion, standardVersion);
  await relink(villageSwitch2, "Village switch-2", goldVersion, standardVersion);

  // Per-platform version dates (shared versions, different dates per game)
  const overrides: Array<{
    gameId: string | undefined;
    versionId: string | undefined;
    date: Date;
    label: string;
  }> = [
    { gameId: re7Switch?.id, versionId: cloudVersion?.id, date: new Date("2022-12-16"), label: "RE7 switch Cloud" },
    { gameId: villageSwitch?.id, versionId: cloudVersion?.id, date: new Date("2022-10-28"), label: "Village switch Cloud" },
    { gameId: re7Switch2?.id, versionId: goldVersion?.id, date: SWITCH2_DATE, label: "RE7 switch-2 Gold" },
    { gameId: villageSwitch2?.id, versionId: goldVersion?.id, date: SWITCH2_DATE, label: "Village switch-2 Gold" },
  ];

  console.log("");
  for (const { gameId, versionId, date, label } of overrides) {
    if (!gameId || !versionId) {
      console.log(`${label}: game or version missing, skipped`);
      continue;
    }
    await prisma.gameVersionReleaseDate.upsert({
      where: { gameId_gameVersionId: { gameId, gameVersionId: versionId } },
      update: { releaseDate: date },
      create: { gameId, gameVersionId: versionId, releaseDate: date },
    });
    console.log(`${label}: ${date.toISOString().split("T")[0]}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
