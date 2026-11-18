import { Prisma, ShowcaseList, SocialNetwork } from "@prisma/client";

export const NAME_MAX_LENGTH = 50;
export const BIO_MAX_LENGTH = 300;
export const SHOWCASE_MAX_GAMES = 10;
const HANDLE_MAX_LENGTH = 64;
// Letters, digits and the separators handles use across these networks.
// Spaces are for Xbox gamertags; "#" for older Discord tags.
const HANDLE_PATTERN = /^[\p{L}\p{N}._# -]+$/u;
const AVATAR_FILE_PATTERN = /^[A-Za-z0-9-]+\.(jpg|jpeg|png|webp)$/;

// Networks with no public profile page (PSN, Xbox, Discord, Nintendo friend
// codes) show the handle as text.
const PROFILE_URLS: Partial<Record<SocialNetwork, (handle: string) => string>> = {
  [SocialNetwork.X]: (h) => `https://x.com/${h}`,
  [SocialNetwork.BLUESKY]: (h) => `https://bsky.app/profile/${h}`,
  [SocialNetwork.INSTAGRAM]: (h) => `https://www.instagram.com/${h}`,
  [SocialNetwork.TIKTOK]: (h) => `https://www.tiktok.com/@${h}`,
  [SocialNetwork.YOUTUBE]: (h) => `https://www.youtube.com/@${h}`,
  [SocialNetwork.TWITCH]: (h) => `https://www.twitch.tv/${h}`,
  [SocialNetwork.STEAM]: (h) => `https://steamcommunity.com/id/${h}`,
};

export function socialProfileUrl(network: SocialNetwork, handle: string): string | null {
  return PROFILE_URLS[network]?.(encodeURIComponent(handle)) ?? null;
}

/// Trims a handle and drops a leading "@". Null when it's not a usable handle.
export function normalizeHandle(raw: string): string | null {
  const handle = raw.trim().replace(/^@/, "");
  if (!handle || handle.length > HANDLE_MAX_LENGTH || !HANDLE_PATTERN.test(handle)) {
    return null;
  }
  return handle;
}

/// Whether a client-supplied avatar key points into this user's own folder.
export function isOwnAvatarPath(path: string, supabaseId: string): boolean {
  const [folder, file, ...rest] = path.split("/");
  return folder === supabaseId && rest.length === 0 && AVATAR_FILE_PATTERN.test(file ?? "");
}

/// Games a user may pin to a list. Used on write and again on read, so a
/// Platinum or collection entry disappears once the trophy or copy does.
export function showcaseEligibleWhere(
  list: ShowcaseList,
  userId: string
): Prisma.GameFamilyWhereInput {
  switch (list) {
    case ShowcaseList.ALL_TIME:
      return {};
    case ShowcaseList.PLATINUMS:
      return { games: { some: { trophies: { some: { userId } } } } };
    case ShowcaseList.COLLECTION:
      return {
        OR: [
          { games: { some: { collectionItems: { some: { userId } } } } },
          { bundles: { some: { collectionItems: { some: { userId } } } } },
        ],
      };
  }
}
