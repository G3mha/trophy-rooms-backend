/**
 * Give the DLC trophy lists a DLC row to live on (2026-11-18).
 *
 * The lists for DLC content were imported without DLC rows (Watch Dogs,
 * Watch Dogs: Legion, Breath of the Wild, Pokopia), so DLC pages had no
 * trophies to show. This creates one DLC row per list and links the list to
 * it through AchievementSet.dlcId. Each list keeps its family, so it stays on
 * the game page too, and still doesn't gate the Platinum.
 *
 * Names, types and dates come from IGDB (games 17473, 139395, 41829 and
 * 405436). IGDB has no entry for Legion's Resistance Mode, a free update, so
 * it has no date. Breath of the Wild's Expansion Pass is a bundle of two packs
 * on IGDB (The Master Trials and The Champions' Ballad), and its one list
 * covers both, so it gets one row. Pokopia's pass comes in three parts and the
 * list covers Part 1, Bubbly Basin, so far, so its date is Part 1's.
 *
 * Watch Dogs 2's "Story DLC" list covers two DLCs (Human Conditions and No
 * Compromise), and a list links to one DLC, so it stays unlinked.
 *
 * Idempotent. Dry run by default:
 *   npx tsx scripts/import-dlcs-for-trophy-lists.ts --apply
 */

import { PrismaClient, DLCType } from "@prisma/client";

const prisma = new PrismaClient();

interface DlcSeed {
  // GameFamily.title, and the AchievementSet.title of the list in it
  family: string;
  list: string;
  name: string;
  slug: string;
  type: DLCType;
  releaseDate: string | null;
  description: string;
}

const DLCS: DlcSeed[] = [
  {
    family: "Watch Dogs",
    list: "Bad Blood",
    name: "Bad Blood",
    slug: "watch-dogs-bad-blood",
    type: DLCType.DLC,
    releaseDate: "2014-09-29",
    description: "A new story as T-Bone Grady, on the run from Blume in Chicago.",
  },
  {
    family: "Watch Dogs: Legion",
    list: "Bloodline",
    name: "Bloodline",
    slug: "watch-dogs-legion-bloodline",
    type: DLCType.DLC,
    releaseDate: "2021-07-06",
    description: "Aiden Pearce and Wrench team up in a new story set before the main game.",
  },
  {
    family: "Watch Dogs: Legion",
    list: "Resistance Mode",
    name: "Resistance Mode",
    slug: "watch-dogs-legion-resistance-mode",
    type: DLCType.FREE_UPDATE,
    releaseDate: null,
    description: "A free update that adds Resistance Mode, the game's hardest difficulty.",
  },
  {
    family: "The Legend of Zelda: Breath of the Wild",
    list: "Expansion Pass",
    name: "Expansion Pass",
    slug: "breath-of-the-wild-expansion-pass",
    type: DLCType.DLC,
    releaseDate: "2017-03-03",
    description: "Both DLC packs: The Master Trials, with Master Mode, and The Champions' Ballad.",
  },
  {
    family: "Pokémon Pokopia",
    list: "Expansion Pass",
    name: "Expansion Pass",
    slug: "pokemon-pokopia-expansion-pass",
    type: DLCType.DLC,
    releaseDate: "2026-08-05",
    description: "A three-part pass. Part 1, Bubbly Basin, adds an underwater area to explore with Dive.",
  },
];

async function main() {
  const apply = process.argv.includes("--apply");

  for (const seed of DLCS) {
    const label = `${seed.family}: ${seed.name}`;
    const sets = await prisma.achievementSet.findMany({
      where: { title: seed.list, gameFamily: { title: seed.family } },
      select: { id: true, dlcId: true, gameFamilyId: true },
    });
    const set = sets[0];
    if (sets.length !== 1 || !set.gameFamilyId) {
      console.log(`SKIP    ${label}: expected one "${seed.list}" list, found ${sets.length}`);
      continue;
    }

    let dlc = await prisma.dLC.findFirst({
      where: { gameFamilyId: set.gameFamilyId, slug: seed.slug },
      select: { id: true },
    });
    if (dlc) {
      console.log(`EXISTS  ${label}`);
    } else {
      console.log(`${apply ? "CREATE " : "PLAN   "} ${label} (${seed.type}, ${seed.releaseDate ?? "no date"})`);
      if (apply) {
        dlc = await prisma.dLC.create({
          data: {
            name: seed.name,
            slug: seed.slug,
            type: seed.type,
            description: seed.description,
            releaseDate: seed.releaseDate ? new Date(seed.releaseDate) : null,
            gameFamilyId: set.gameFamilyId,
          },
          select: { id: true },
        });
      }
    }

    if (set.dlcId && set.dlcId === dlc?.id) {
      console.log(`LINKED  ${label}`);
    } else if (set.dlcId) {
      // Never move a list off a DLC someone else linked it to
      console.log(`SKIP    ${label}: the list already belongs to another DLC (${set.dlcId})`);
    } else {
      console.log(`${apply ? "LINK   " : "PLAN   "} ${label}: "${seed.list}" list`);
      if (apply && dlc) {
        await prisma.achievementSet.update({ where: { id: set.id }, data: { dlcId: dlc.id } });
      }
    }
  }

  if (!apply) console.log("\nDry run. Pass --apply to write.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
