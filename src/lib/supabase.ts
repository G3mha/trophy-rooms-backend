import { createRemoteJWKSet, jwtVerify } from "jose";
import { logger } from "./logger.js";

// A wrong or missing project URL silently breaks every token verification, so
// resolve it at boot: a misconfigured deploy fails its healthcheck instead of
// rejecting logins against the wrong project.
function requireSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL;
  if (!url) {
    throw new Error("SUPABASE_URL is required");
  }
  return url;
}

const SUPABASE_URL = requireSupabaseUrl();

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

/// Permanently deletes a user from Supabase Auth via the admin API.
/// Requires the service-role key (SUPABASE_SECRET_KEY).
export async function deleteSupabaseUser(supabaseId: string): Promise<boolean> {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    logger.error("SUPABASE_SECRET_KEY is not configured");
    return false;
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${supabaseId}`,
      {
        method: "DELETE",
        headers: {
          apikey: secretKey,
          Authorization: `Bearer ${secretKey}`,
        },
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
