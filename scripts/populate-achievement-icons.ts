import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile?.();
} catch {
  // Ignore missing local env files in deployed environments.
}

const prisma = new PrismaClient();

const RETRO_API_KEY = process.env.RETROACHIEVEMENTS_API_KEY ?? process.env.RA_WEB_API_KEY;

if (!RETRO_API_KEY) {
  throw new Error("RETROACHIEVEMENTS_API_KEY or RA_WEB_API_KEY environment variable is required");
}

type SourceConfig =
  | {
      type: "retroachievements";
      setTitle: string;
      gameTitle: string;
      retroGameId: number;
      aliases?: Record<string, string>;
      syntheticIcons?: Record<string, string>;
    }
  | {
      type: "steam";
      setTitle: string;
      gameTitle: string;
      steamAppId: number;
      aliases?: Record<string, string>;
    };

const SOURCES: SourceConfig[] = [
  {
    type: "retroachievements",
    setTitle: "RetroAchievements set",
    gameTitle: "Mario Kart: Double Dash!!",
    retroGameId: 7693,
    syntheticIcons: {
      "Retro Mastery": "__RETRO_GAME_ICON__",
    },
  },
  {
    type: "steam",
    setTitle: "PSN Achievement Set",
    gameTitle: "Hotline Miami",
    steamAppId: 219150,
    aliases: {
      "Trophy Addict": "Achievement Whore",
    },
  },
  {
    type: "steam",
    setTitle: "PSN Achievement Set",
    gameTitle: "Resident Evil Requiem",
    steamAppId: 3764200,
    // Steam ships the 49 trophies without a platinum, so "Requiem" stays iconless.
  },
];

function normalizeTitle(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

async function fetchRetroAchievementsIcons(
  retroGameId: number
): Promise<{ iconsByTitle: Map<string, string>; gameIconUrl: string | null }> {
  const response = await fetch(
    `https://retroachievements.org/API/API_GetGameExtended.php?i=${retroGameId}&y=${RETRO_API_KEY}`
  );

  if (!response.ok) {
    throw new Error(
      `RetroAchievements request failed (${response.status}) for game ${retroGameId}`
    );
  }

  const payload = (await response.json()) as {
    Achievements?: Record<string, { Title?: string; BadgeName?: string }>;
    ImageIcon?: string;
    imageIcon?: string;
  };

  const iconsByTitle = new Map<string, string>();
  const achievements = Object.values(payload.Achievements ?? {});

  for (const achievement of achievements) {
    const title = achievement.Title?.trim();
    const badgeName = achievement.BadgeName?.trim();
    if (!title || !badgeName) {
      continue;
    }

    iconsByTitle.set(
      normalizeTitle(title),
      `https://media.retroachievements.org/Badge/${badgeName}.png`
    );
  }

  const imageIcon = payload.ImageIcon ?? payload.imageIcon ?? null;
  return {
    iconsByTitle,
    gameIconUrl: imageIcon
      ? imageIcon.startsWith("http")
        ? imageIcon
        : `https://media.retroachievements.org${imageIcon}`
      : null,
  };
}

// Steam Community retired the `?xml=1` achievement feed when the site became
// client-rendered. The page now reads its data from this Web API method, which
// needs no key, so the script does the same.
const STEAM_ACHIEVEMENTS_ENDPOINT =
  "https://api.steampowered.com/IPlayerService/GetGameAchievements/v1/";
const STEAM_ICON_BASE = "https://cdn.fastly.steamstatic.com/steamcommunity/public/images/apps";

type SteamAchievement = {
  localized_name?: string;
  icon?: string;
};

function buildSteamIconUrl(steamAppId: number, icon: string): string {
  return icon.startsWith("http") ? icon : `${STEAM_ICON_BASE}/${steamAppId}/${icon}`;
}

async function fetchSteamIcons(steamAppId: number): Promise<Map<string, string>> {
  const url = new URL(STEAM_ACHIEVEMENTS_ENDPOINT);
  url.searchParams.set("appid", String(steamAppId));
  url.searchParams.set("language", "english");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Steam Web API request failed (${response.status}) for app ${steamAppId}`);
  }

  const payload = (await response.json()) as {
    response?: { achievements?: SteamAchievement[] };
  };

  const achievements = payload.response?.achievements ?? [];

  if (achievements.length === 0) {
    throw new Error(`Steam Web API returned no achievements for app ${steamAppId}`);
  }

  const iconsByTitle = new Map<string, string>();

  for (const achievement of achievements) {
    const title = achievement.localized_name?.trim();
    const icon = achievement.icon?.trim();

    if (!title || !icon) {
      continue;
    }

    iconsByTitle.set(normalizeTitle(title), buildSteamIconUrl(steamAppId, icon));
  }

  return iconsByTitle;
}

async function populateSetIcons(config: SourceConfig) {
  const achievementSet = await prisma.achievementSet.findFirst({
    where: {
      title: config.setTitle,
      gameFamily: {
        title: config.gameTitle,
      },
    },
    include: {
      achievements: true,
      gameFamily: true,
    },
  });

  if (!achievementSet) {
    console.log(`Skipping missing set: ${config.setTitle} / ${config.gameTitle}`);
    return;
  }

  let iconsByTitle = new Map<string, string>();
  const syntheticIcons = new Map<string, string>();

  if (config.type === "retroachievements") {
    const retro = await fetchRetroAchievementsIcons(config.retroGameId);
    iconsByTitle = retro.iconsByTitle;

    for (const [title, placeholder] of Object.entries(config.syntheticIcons ?? {})) {
      if (placeholder === "__RETRO_GAME_ICON__" && retro.gameIconUrl) {
        syntheticIcons.set(normalizeTitle(title), retro.gameIconUrl);
      }
    }
  } else if (config.type === "steam") {
    iconsByTitle = await fetchSteamIcons(config.steamAppId);
  }

  const aliases = new Map<string, string>();
  for (const [localTitle, sourceTitle] of Object.entries(config.aliases ?? {})) {
    aliases.set(normalizeTitle(localTitle), normalizeTitle(sourceTitle));
  }

  let updated = 0;
  let unmatched = 0;

  for (const achievement of achievementSet.achievements) {
    const normalizedLocalTitle = normalizeTitle(achievement.title);
    const sourceKey = aliases.get(normalizedLocalTitle) ?? normalizedLocalTitle;
    const iconUrl =
      iconsByTitle.get(sourceKey) ?? syntheticIcons.get(normalizedLocalTitle) ?? null;

    if (!iconUrl) {
      unmatched += 1;
      continue;
    }

    if (achievement.iconUrl === iconUrl) {
      continue;
    }

    await prisma.achievement.update({
      where: { id: achievement.id },
      data: { iconUrl },
    });
    updated += 1;
  }

  console.log(
    `${config.gameTitle} / ${config.setTitle}: updated ${updated}, unmatched ${unmatched}`
  );
}

async function main() {
  for (const source of SOURCES) {
    await populateSetIcons(source);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
