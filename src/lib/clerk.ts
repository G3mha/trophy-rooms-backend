import { verifyToken } from "@clerk/backend";
import { logger } from "./logger.js";

export interface ClerkUser {
  id: string;
  email: string;
  name: string | null;
}

export async function verifyClerkToken(
  token: string
): Promise<ClerkUser | null> {
  try {
    const secretKey = process.env.CLERK_SECRET_KEY;

    if (!secretKey) {
      logger.error("CLERK_SECRET_KEY is not configured");
      return null;
    }

    const decoded = await verifyToken(token, {
      secretKey,
    });

    if (!decoded.sub) {
      return null;
    }

    return {
      id: decoded.sub,
      email: (decoded.email as string) ?? "",
      name: (decoded.name as string) ?? null,
    };
  } catch (error) {
    logger.debug({ error }, "Token verification failed");
    return null;
  }
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}
