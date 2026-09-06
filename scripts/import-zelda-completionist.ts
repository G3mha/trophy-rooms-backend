import {
  AchievementSetType,
  AchievementSetVisibility,
  AchievementTier,
  PrismaClient,
} from "@prisma/client";

try {
  process.loadEnvFile?.();
} catch {
  // Ignore missing env file in deployed environments.
}

const prisma = new PrismaClient();

const RETRO_API_KEY = process.env.RETROACHIEVEMENTS_API_KEY ?? process.env.RA_WEB_API_KEY;

if (!RETRO_API_KEY) {
  throw new Error("RETROACHIEVEMENTS_API_KEY or RA_WEB_API_KEY environment variable is required");
}

const SET_TITLE = "Completionist set";

const OOT_ORIGINAL_FAMILY_ID = "cmokvbc3i00a90mxepoc9yo8j";
const MM_ORIGINAL_FAMILY_ID = "cmokvbc3i00a80mxe6irf4zi6";

function tierForPoints(points: number): AchievementTier {
  if (points >= 25) {
    return AchievementTier.GOLD;
  }

  if (points >= 10) {
    return AchievementTier.SILVER;
  }

  return AchievementTier.BRONZE;
}

function uniquifyTitles<T extends { title: string }>(items: T[]) {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const count = (seen.get(item.title) ?? 0) + 1;
    seen.set(item.title, count);

    if (count === 1) {
      return item;
    }

    return {
      ...item,
      title: `${item.title} (${count})`,
    };
  });
}

async function fetchRetroGame(retroGameId: number) {
  const response = await fetch(
    `https://retroachievements.org/API/API_GetGameExtended.php?i=${retroGameId}&y=${RETRO_API_KEY}`
  );

  if (!response.ok) {
    throw new Error(`RetroAchievements request failed (${response.status}) for game ${retroGameId}`);
  }

  return response.json() as Promise<{
    Achievements?: Record<string, {
      ID: number;
      Title?: string;
      Description?: string;
      Points?: number;
      BadgeName?: string;
      DisplayOrder?: number;
    }>;
  }>;
}

async function ensure3DSFamily(input: {
  title: string;
  slug: string;
  description: string;
  coverUrl: string;
  releaseDate: Date;
}) {
  const platform = await prisma.platform.findUnique({
    where: { slug: "3ds" },
  });

  if (!platform) {
    throw new Error("Nintendo 3DS platform not found");
  }

  const family = await prisma.gameFamily.upsert({
    where: { slug: input.slug },
    update: {
      title: input.title,
      description: input.description,
      coverUrl: input.coverUrl,
      releaseDate: input.releaseDate,
    },
    create: {
      title: input.title,
      slug: input.slug,
      description: input.description,
      coverUrl: input.coverUrl,
      releaseDate: input.releaseDate,
    },
  });

  const existingGame = await prisma.game.findFirst({
    where: {
      gameFamilyId: family.id,
      platformId: platform.id,
    },
  });

  if (!existingGame) {
    await prisma.game.create({
      data: {
        gameFamilyId: family.id,
        platformId: platform.id,
        releaseDate: input.releaseDate,
        coverUrl: input.coverUrl,
      },
    });
  }

  return family;
}

async function ensureSetFromRetroAchievements(familyId: string, retroGameId: number) {
  const family = await prisma.gameFamily.findUnique({
    where: { id: familyId },
    include: {
      achievementSets: {
        include: {
          achievements: true,
        },
      },
    },
  });

  if (!family) {
    throw new Error(`Game family not found: ${familyId}`);
  }

  const existingSet = family.achievementSets.find((set) => set.title === SET_TITLE);
  if (existingSet) {
    return existingSet;
  }

  const retroGame = await fetchRetroGame(retroGameId);
  const achievements = Object.values(retroGame.Achievements ?? {})
    .filter((achievement) => achievement.Title?.trim())
    .sort((left, right) => {
      const leftOrder = left.DisplayOrder ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.DisplayOrder ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      return left.ID - right.ID;
    })
    .map((achievement) => {
      const points = achievement.Points ?? 0;
      const badgeName = achievement.BadgeName?.trim();
      return {
        title: achievement.Title!.trim(),
        description: achievement.Description?.trim() || null,
        points,
        tier: tierForPoints(points),
        iconUrl: badgeName
          ? `https://media.retroachievements.org/Badge/${badgeName}.png`
          : null,
      };
    });

  const uniqueAchievements = uniquifyTitles(achievements);

  const createdSet = await prisma.achievementSet.create({
    data: {
      title: SET_TITLE,
      type: AchievementSetType.OFFICIAL,
      visibility: AchievementSetVisibility.PUBLIC,
      gameFamilyId: family.id,
    },
  });

  for (const achievement of uniqueAchievements) {
    await prisma.achievement.create({
      data: {
        ...achievement,
        achievementSetId: createdSet.id,
      },
    });
  }

  return prisma.achievementSet.findUniqueOrThrow({
    where: { id: createdSet.id },
    include: {
      achievements: true,
    },
  });
}

async function cloneCompletionistSet(sourceFamilyId: string, targetFamilyId: string) {
  const targetFamily = await prisma.gameFamily.findUnique({
    where: { id: targetFamilyId },
    include: {
      achievementSets: {
        include: {
          achievements: true,
        },
      },
    },
  });

  if (!targetFamily) {
    throw new Error(`Target game family not found: ${targetFamilyId}`);
  }

  const existingSet = targetFamily.achievementSets.find((set) => set.title === SET_TITLE);
  if (existingSet) {
    return existingSet;
  }

  const sourceFamily = await prisma.gameFamily.findUnique({
    where: { id: sourceFamilyId },
    include: {
      achievementSets: {
        include: {
          achievements: true,
        },
      },
    },
  });

  if (!sourceFamily) {
    throw new Error(`Source game family not found: ${sourceFamilyId}`);
  }

  const sourceSet = sourceFamily.achievementSets.find((set) => set.title === SET_TITLE);
  if (!sourceSet) {
    throw new Error(`Source set "${SET_TITLE}" not found on ${sourceFamily.title}`);
  }

  const clonedSet = await prisma.achievementSet.create({
    data: {
      title: SET_TITLE,
      type: AchievementSetType.OFFICIAL,
      visibility: AchievementSetVisibility.PUBLIC,
      gameFamilyId: targetFamilyId,
    },
  });

  for (const achievement of sourceSet.achievements) {
    await prisma.achievement.create({
      data: {
        title: achievement.title,
        description: achievement.description,
        points: achievement.points,
        tier: achievement.tier,
        iconUrl: achievement.iconUrl,
        achievementSetId: clonedSet.id,
      },
    });
  }

  return prisma.achievementSet.findUniqueOrThrow({
    where: { id: clonedSet.id },
    include: {
      achievements: true,
    },
  });
}

async function main() {
  const oot3dFamily = await ensure3DSFamily({
    title: "The Legend of Zelda: Ocarina of Time 3D",
    slug: "the-legend-of-zelda-ocarina-of-time-3d",
    description:
      "The Legend of Zelda: Ocarina of Time 3D is a remake of Ocarina of Time with more up-to-date graphics, streamlined UI and different additional game modes. Most textures are significantly more detailed, and many models are more faithful to the game's concept and promotional art. In addition, the frame rate has been increased to 30 FPS compared to the original's 20 FPS.",
    coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co600u.jpg",
    releaseDate: new Date("2011-06-16T00:00:00.000Z"),
  });

  const mm3dFamily = await ensure3DSFamily({
    title: "The Legend of Zelda: Majora's Mask 3D",
    slug: "the-legend-of-zelda-majoras-mask-3d",
    description:
      "The Legend of Zelda: Majora's Mask 3D is a remake of the original Nintendo 64 game with more up-to-date graphics, streamlined UI and different additional game modes. Most textures are significantly more detailed, and many models are more faithful to the game's concept and promotional art. In addition, the frame rate has been increased to 30 FPS compared to the original's 20 FPS.",
    coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/cob9x9.jpg",
    releaseDate: new Date("2015-02-12T00:00:00.000Z"),
  });

  const ootSet = await ensureSetFromRetroAchievements(OOT_ORIGINAL_FAMILY_ID, 10113);
  const mmSet = await ensureSetFromRetroAchievements(MM_ORIGINAL_FAMILY_ID, 10679);
  const oot3dSet = await cloneCompletionistSet(OOT_ORIGINAL_FAMILY_ID, oot3dFamily.id);
  const mm3dSet = await cloneCompletionistSet(MM_ORIGINAL_FAMILY_ID, mm3dFamily.id);

  console.log(
    JSON.stringify(
      {
        originals: [
          {
            familyId: OOT_ORIGINAL_FAMILY_ID,
            title: "The Legend of Zelda: Ocarina of Time",
            setId: ootSet.id,
            achievements: ootSet.achievements.length,
          },
          {
            familyId: MM_ORIGINAL_FAMILY_ID,
            title: "The Legend of Zelda: Majora's Mask",
            setId: mmSet.id,
            achievements: mmSet.achievements.length,
          },
        ],
        remakes: [
          {
            familyId: oot3dFamily.id,
            title: oot3dFamily.title,
            setId: oot3dSet.id,
            achievements: oot3dSet.achievements.length,
          },
          {
            familyId: mm3dFamily.id,
            title: mm3dFamily.title,
            setId: mm3dSet.id,
            achievements: mm3dSet.achievements.length,
          },
        ],
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
