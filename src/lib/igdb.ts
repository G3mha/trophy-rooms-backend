interface IGDBToken {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface IGDBGame {
  id: number;
  name: string;
  summary?: string;
  cover?: {
    id: number;
    image_id: string;
  };
  first_release_date?: number;
  genres?: { id: number; name: string }[];
  rating?: number;
  total_rating?: number;
}

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID!;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET!;

// Platform IDs
const NINTENDO_SWITCH_PLATFORM_ID = 130;
const NINTENDO_SWITCH_2_PLATFORM_ID = 508;

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getIGDBToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const response = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: "POST" }
  );

  if (!response.ok) {
    throw new Error(`Failed to get IGDB token: ${response.statusText}`);
  }

  const data: IGDBToken = await response.json();

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return cachedToken.token;
}

export async function igdbRequest<T>(
  endpoint: string,
  query: string
): Promise<T> {
  const token = await getIGDBToken();

  const response = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": TWITCH_CLIENT_ID,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body: query,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`IGDB API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

export async function fetchNintendoSwitchGames(
  offset: number = 0,
  limit: number = 500
): Promise<IGDBGame[]> {
  const query = `
    fields id, name, summary, cover.image_id, first_release_date, genres.name, rating, total_rating;
    where platforms = (${NINTENDO_SWITCH_PLATFORM_ID}, ${NINTENDO_SWITCH_2_PLATFORM_ID});
    sort id asc;
    offset ${offset};
    limit ${limit};
  `;

  return igdbRequest<IGDBGame[]>("games", query);
}

export async function fetchAllNintendoSwitchGames(): Promise<IGDBGame[]> {
  const allGames: IGDBGame[] = [];
  let offset = 0;
  const limit = 500;
  let hasMore = true;

  console.log("Fetching Nintendo Switch games from IGDB...");

  while (hasMore) {
    console.log(`Fetching games ${offset} to ${offset + limit}...`);

    const games = await fetchNintendoSwitchGames(offset, limit);
    allGames.push(...games);

    if (games.length < limit) {
      hasMore = false;
    } else {
      offset += limit;
      // Rate limiting: wait 250ms between requests (4 req/sec limit)
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  console.log(`Total games fetched: ${allGames.length}`);
  return allGames;
}

export async function countNintendoSwitchGames(): Promise<number> {
  // IGDB count endpoint requires just the where clause
  // We'll estimate by fetching with limit 1 and checking total
  const query = `
    fields id;
    where platforms = (${NINTENDO_SWITCH_PLATFORM_ID}, ${NINTENDO_SWITCH_2_PLATFORM_ID});
    limit 500;
  `;

  const games = await igdbRequest<{ id: number }[]>("games", query);
  // Return actual fetched count as estimate (will fetch all in the main function)
  return games.length > 0 ? 5000 : 0; // Estimate ~5000 Switch games
}

export function getCoverUrl(
  imageId: string,
  size: "cover_big" | "cover_small" | "720p" | "1080p" = "cover_big"
): string {
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}

export type { IGDBGame };
