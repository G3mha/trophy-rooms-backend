import { createRemoteJWKSet, jwtVerify } from "jose";
import { logger } from "./logger.js";

// A missing value silently breaks sign-in, so resolve both at boot: a
// misconfigured deploy fails its healthcheck instead.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

// A wrong project URL rejects every login against the wrong project.
const SUPABASE_URL = requireEnv("SUPABASE_URL");
// The service-role key. Without it no new identity can be confirmed, so
// createContext would never create an account.
const SUPABASE_SECRET_KEY = requireEnv("SUPABASE_SECRET_KEY");
const adminHeaders = {
  apikey: SUPABASE_SECRET_KEY,
  Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
};

export interface SupabaseUser {
  id: string;
  email: string;
  name: string | null;
}

// The project signs access tokens with an asymmetric key (ES256); the public
// half is served at the JWKS endpoint, so verification needs no shared secret.
const jwks = createRemoteJWKSet(
  new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
);

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

export async function verifySupabaseToken(
  token: string
): Promise<SupabaseUser | null> {
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `${SUPABASE_URL}/auth/v1`,
    });

    if (!payload.sub) return null;

    const metadata = (payload.user_metadata ?? {}) as Record<string, unknown>;
    const name =
      typeof metadata.full_name === "string"
        ? metadata.full_name
        : typeof metadata.name === "string"
          ? metadata.name
          : null;

    return {
      id: payload.sub,
      email: typeof payload.email === "string" ? payload.email : "",
      name,
    };
  } catch {
    return null;
  }
}

/// Whether Supabase confirms the Auth user exists. False when it's gone and
/// when Supabase can't be reached.
export async function supabaseUserExists(supabaseId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${supabaseId}`,
      { headers: adminHeaders }
    );
    if (response.ok) return true;
    if (response.status !== 404) {
      logger.warn({ status: response.status, supabaseId }, "Could not look up Supabase user");
    }
    return false;
  } catch (error) {
    logger.warn({ error, supabaseId }, "Could not look up Supabase user");
    return false;
  }
}

/// Permanently deletes a user from Supabase Auth via the admin API.
export async function deleteSupabaseUser(supabaseId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${supabaseId}`,
      {
        method: "DELETE",
        headers: adminHeaders,
      }
    );

    if (!response.ok) {
      logger.error(
        { status: response.status, supabaseId },
        "Failed to delete Supabase user"
      );
      return false;
    }
    return true;
  } catch (error) {
    logger.error({ error, supabaseId }, "Failed to delete Supabase user");
    return false;
  }
}

// Profile pictures live in a private bucket: clients upload into their own
// "<supabaseId>/" folder (storage RLS enforces it), and everyone reads them
// through signed URLs the API hands out.
export const AVATAR_BUCKET = "avatars";
const AVATAR_URL_TTL_SECONDS = 60 * 60;

/// A signed URL for an avatar, or null when the object is missing or
/// Supabase can't be reached.
// shortcut: signs on every read, so browsers refetch the image each page
// load; cache the URL (e.g. in Redis) if profile lists start showing avatars.
export async function signAvatarUrl(path: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/sign/${AVATAR_BUCKET}/${path}`,
      {
        method: "POST",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn: AVATAR_URL_TTL_SECONDS }),
      }
    );
    if (!response.ok) return null;
    const { signedURL } = (await response.json()) as { signedURL?: string };
    return signedURL ? `${SUPABASE_URL}/storage/v1${signedURL}` : null;
  } catch (error) {
    logger.warn({ error, path }, "Could not sign avatar URL");
    return null;
  }
}

/// Deletes every file in the user's avatar folder except `keepPath`, which
/// also clears uploads that were never saved to the profile. False when
/// Supabase didn't confirm, so callers can refuse to drop the reference.
export async function pruneAvatars(
  supabaseId: string,
  keepPath: string | null
): Promise<boolean> {
  try {
    const listed = await fetch(
      `${SUPABASE_URL}/storage/v1/object/list/${AVATAR_BUCKET}`,
      {
        method: "POST",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: supabaseId, limit: 1000 }),
      }
    );
    if (!listed.ok) {
      logger.error({ status: listed.status, supabaseId }, "Could not list avatars");
      return false;
    }
    const objects = (await listed.json()) as { name: string }[];
    const stale = objects
      .map((object) => `${supabaseId}/${object.name}`)
      .filter((path) => path !== keepPath);
    if (stale.length === 0) return true;

    const deleted = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${AVATAR_BUCKET}`,
      {
        method: "DELETE",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: stale }),
      }
    );
    if (!deleted.ok) {
      logger.error({ status: deleted.status, supabaseId }, "Could not delete avatars");
      return false;
    }
    return true;
  } catch (error) {
    logger.error({ error, supabaseId }, "Could not prune avatars");
    return false;
  }
}
