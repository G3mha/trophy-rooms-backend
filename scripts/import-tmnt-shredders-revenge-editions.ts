/**
 * TMNT: Shredder's Revenge editions pass (2026-07-22).
 *
 * Platforms: the game launched 2022-06-16 on PS4/Xbox One/Switch/PC - add
 * the missing ps4/xbox-one/steam entries. The seeded ps5 entry gets the
 * native PS5 release date (Anniversary wave, 2023-11-17); the xbox-series
 * entry is backward-compat only (no native release) and is removed.
 *
 * Editions (as shared GameVersions):
 * - Signature Edition (Merge Games retail wave 2022-07-29: eye mask etc.)
 *   on switch/ps4/xbox-one
 * - Classic Edition (Limited Run: VHS-style box + SteelBook + reversible
 *   cover/decals) on switch/ps4/xbox-one
 * - Radical Edition (Limited Run $199.99: Classic contents + strategy
 *   guide, poster, Shredder figure, shadow box, light-and-sound mini
 *   arcade cabinet, CD soundtrack) on switch/ps4/xbox-one
 * - Anniversary Edition (Merge 2023-11-17, Dimension Shellshock DLC on
 *   cart) and Anniversary Classic Edition (VHS box + slipcover + guide)
 *   on switch/ps4/ps5
 *
 * DLC: Dimension Shellshock (2023-08-31).
 */

import { PrismaClient, DLCType } from "@prisma/client";

const prisma = new PrismaClient();

const FAMILY_TITLE = "Teenage Mutant Ninja Turtles: Shredder's Revenge";
const LAUNCH = "2022-06-16";

async function version(slug: string, name: string, description: string | null, releaseDate: string | null) {
  const existing = await prisma.gameVersion.findUnique({ where: { slug } });
  if (existing) return existing;
  const v = await prisma.gameVersion.create({
    data: {
      slug,
      name,
      description,
      releaseDate: releaseDate ? new Date(releaseDate) : null,
      isDefault: false,
    },
  });
  console.log(`Created version: ${name}`);
  return v;
}

async function main() {
  console.log("=== TMNT: Shredder's Revenge editions ===\n");

  const family = await prisma.gameFamily.findFirst({
    where: { title: { equals: FAMILY_TITLE, mode: "insensitive" } },
    include: { games: { include: { platform: true, versions: true } } },
  });
  if (!family) {
    console.error("Family not found");
    return;
  }
  const standard = await prisma.gameVersion.findUnique({ where: { slug: "standard" } });

  // --- Platform corrections ---
  for (const slug of ["ps4", "xbox-one", "steam"]) {
    if (family.games.some((g) => g.platform?.slug === slug)) {
      console.log(`${slug}: already exists`);
      continue;
    }
    const platform = await prisma.platform.findUnique({ where: { slug } });
    if (!platform) continue;
    await prisma.game.create({
      data: {
        gameFamilyId: family.id,
        platformId: platform.id,
        releaseDate: new Date(LAUNCH),
        ...(standard ? { versions: { connect: [{ id: standard.id }] } } : {}),
      },
    });
    console.log(`${slug}: created @${LAUNCH}`);
  }

  const ps5Game = family.games.find((g) => g.platform?.slug === "ps5");
  if (ps5Game && ps5Game.releaseDate?.toISOString().startsWith("2022")) {
    await prisma.game.update({
      where: { id: ps5Game.id },
      data: { releaseDate: new Date("2023-11-17") },
    });
    console.log("ps5: date -> 2023-11-17 (native release with Anniversary wave)");
  }

  const xsxGame = family.games.find((g) => g.platform?.slug === "xbox-series");
  if (xsxGame) {
    const counts = await prisma.game.findUnique({
      where: { id: xsxGame.id },
      include: {
        _count: { select: { userGames: true, collectionItems: true, trophies: true, buylistItems: true } },
      },
    });
    const c = counts?._count;
    if (c && c.userGames + c.collectionItems + c.trophies + c.buylistItems === 0) {
      await prisma.game.delete({ where: { id: xsxGame.id } });
      console.log("xbox-series: removed (backward compatibility only, no native release)");
    } else {
      console.log("xbox-series: has user data, kept");
    }
  }

  // --- Edition versions ---
  const signature = await version(
    "signature-edition",
    "Signature Edition",
    "Merge Games retail collector wave (2022-07-29): includes a Teenage Mutant Ninja Turtles eye mask and Signature packaging.",
    "2022-07-29"
  );
  const classic = await version(
    "classic-edition",
    "Classic Edition",
    "Limited Run edition: standard contents (reversible cover, decals) plus a VHS-inspired box and SteelBook.",
    null
  );
  const radical = await version(
    "radical-edition",
    "Radical Edition",
    "Limited Run collector edition: Classic Edition contents plus strategy guide, poster, Shredder action figure, shadow box, light-and-sound mini arcade cabinet replica, CD soundtrack, and blister box packaging.",
    null
  );
  const anniversary = await version(
    "anniversary-edition",
    "Anniversary Edition",
    "Merge Games physical (2023-11-17) with the Dimension Shellshock DLC included on cartridge/disc.",
    "2023-11-17"
  );
  const anniversaryClassic = await version(
    "anniversary-classic-edition",
    "Anniversary Classic Edition",
    "Anniversary Edition plus retro slipcover, VHS-style box, and strategy guide.",
    "2023-11-17"
  );

  const refreshed = await prisma.gameFamily.findFirst({
    where: { id: family.id },
    include: { games: { include: { platform: true, versions: true } } },
  });

  const linkPlan: Array<{ versionId: string; name: string; platforms: string[] }> = [
    { versionId: signature.id, name: "Signature", platforms: ["switch", "ps4", "xbox-one"] },
    { versionId: classic.id, name: "Classic", platforms: ["switch", "ps4", "xbox-one"] },
    { versionId: radical.id, name: "Radical", platforms: ["switch", "ps4", "xbox-one"] },
    { versionId: anniversary.id, name: "Anniversary", platforms: ["switch", "ps4", "ps5"] },
    { versionId: anniversaryClassic.id, name: "Anniversary Classic", platforms: ["switch", "ps4", "ps5"] },
  ];

  for (const plan of linkPlan) {
    for (const slug of plan.platforms) {
      const game = refreshed?.games.find((g) => g.platform?.slug === slug);
      if (!game) continue;
      if (game.versions.some((v) => v.id === plan.versionId)) continue;
      await prisma.game.update({
        where: { id: game.id },
        data: { versions: { connect: [{ id: plan.versionId }] } },
      });
      console.log(`${plan.name} -> ${slug}`);
    }
  }

  // --- Dimension Shellshock DLC ---
  const dlcSlug = "tmnt-shredders-revenge-dimension-shellshock";
  const existingDlc = await prisma.dLC.findFirst({ where: { slug: dlcSlug } });
  if (!existingDlc) {
    await prisma.dLC.create({
      data: {
        name: "Dimension Shellshock",
        slug: dlcSlug,
        type: DLCType.DLC,
        description:
          "Adds Survival Mode, playable Usagi Yojimbo and Karai, and new color palettes.",
        releaseDate: new Date("2023-08-31"),
        gameFamilyId: family.id,
      },
    });
    console.log("Created DLC: Dimension Shellshock");
  } else {
    console.log("Dimension Shellshock DLC already exists");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
