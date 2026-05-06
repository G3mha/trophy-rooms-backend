import { AchievementSetType, AchievementSetVisibility, AchievementTier, PrismaClient } from "@prisma/client";

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

interface RetroAchievement {
  ID: number;
  Title?: string;
  Description?: string;
  Points?: number;
  BadgeName?: string;
  DisplayOrder?: number;
}

interface RetroGameResponse {
  ID: number;
  Title?: string;
  Achievements?: Record<string, RetroAchievement>;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    gameFamilyId: "",
    retroGameId: 0,
    setTitle: "RetroAchievements set",
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === "--game-family-id" && next) {
      options.gameFamilyId = next.trim();
      index += 1;
      continue;
    }

    if (arg === "--ra-game-id" && next) {
      options.retroGameId = Number.parseInt(next, 10);
      index += 1;
      continue;
    }

    if (arg === "--set-title" && next) {
      options.setTitle = next.trim();
      index += 1;
    }
  }

  if (!options.gameFamilyId) {
    throw new Error("--game-family-id is required");
  }

  if (!Number.isFinite(options.retroGameId) || options.retroGameId <= 0) {
    throw new Error("--ra-game-id must be a positive integer");
  }

  return options;
}

function tierForRetroPoints(points: number): AchievementTier {
  if (points >= 25) {
    return AchievementTier.GOLD;
  }

  if (points >= 10) {
    return AchievementTier.SILVER;
  }

  return AchievementTier.BRONZE;
}

async function fetchRetroGame(retroGameId: number): Promise<RetroGameResponse> {
  const response = await fetch(
    `https://retroachievements.org/API/API_GetGameExtended.php?i=${retroGameId}&y=${RETRO_API_KEY}`
  );

  if (!response.ok) {
    throw new Error(`RetroAchievements request failed (${response.status}) for game ${retroGameId}`);
  }

  return (await response.json()) as RetroGameResponse;
}

async function main() {
  const options = parseArgs();

  const gameFamily = await prisma.gameFamily.findUnique({
    where: { id: options.gameFamilyId },
    include: {
      achievementSets: {
        include: {
          achievements: true,
        },
      },
    },
  });

  if (!gameFamily) {
    throw new Error(`Game family not found: ${options.gameFamilyId}`);
  }

  const existingSet = gameFamily.achievementSets.find(
    (set) => set.title === options.setTitle && set.type === AchievementSetType.OFFICIAL
  );

  if (existingSet) {
    throw new Error(
      `Set "${options.setTitle}" already exists for ${gameFamily.title} with ${existingSet.achievements.length} achievements`
    );
  }

  const retroGame = await fetchRetroGame(options.retroGameId);
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
        tier: tierForRetroPoints(points),
        iconUrl: badgeName
          ? `https://media.retroachievements.org/Badge/${badgeName}.png`
          : null,
      };
    });

  if (achievements.length === 0) {
    throw new Error(`No achievements returned by RetroAchievements for game ${options.retroGameId}`);
  }

  const createdSet = await prisma.achievementSet.create({
    data: {
      title: options.setTitle,
      type: AchievementSetType.OFFICIAL,
      visibility: AchievementSetVisibility.PUBLIC,
      gameFamilyId: gameFamily.id,
    },
  });

  for (const achievement of achievements) {
    await prisma.achievement.create({
      data: {
        ...achievement,
        achievementSetId: createdSet.id,
      },
    });
  }

  console.log(
    `Imported ${achievements.length} RetroAchievements entries into "${options.setTitle}" for ${gameFamily.title}`
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
