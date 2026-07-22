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

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
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

async function fetchSteamIcons(steamAppId: number): Promise<Map<string, string>> {
  const response = await fetch(
    `https://steamcommunity.com/stats/${steamAppId}/achievements?xml=1`
  );

  if (!response.ok) {
    throw new Error(
      `Steam Community request failed (${response.status}) for app ${steamAppId}`
    );
  }

  const html = await response.text();
  const iconsByTitle = new Map<string, string>();
  const achievementBlocks =
    html.match(/<div class="achieveRow[\s\S]*?<div style="clear: both;"><\/div>\s*<\/div>/g) ??
    [];

  for (const block of achievementBlocks) {
    const nameMatch = block.match(/<h3>(.*?)<\/h3>/s);
    const iconMatch = block.match(/<img src="([^"]+)"/s);

    const title = decodeXmlEntities(nameMatch?.[1]?.trim() ?? "");
    const iconUrl = decodeXmlEntities(iconMatch?.[1]?.trim() ?? "");

    if (!title || !iconUrl) {
      continue;
    }

    iconsByTitle.set(normalizeTitle(title), iconUrl);
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
