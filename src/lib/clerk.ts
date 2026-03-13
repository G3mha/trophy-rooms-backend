import { verifyToken, createClerkClient } from "@clerk/backend";
import { logger } from "./logger.js";

export interface ClerkUser {
  id: string;
  email: string;
  name: string | null;
}

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

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

export async function fetchClerkUserData(
  clerkUserId: string
): Promise<ClerkUser | null> {
  try {
    const user = await clerkClient.users.getUser(clerkUserId);

    const primaryEmail = user.emailAddresses.find(
      (email) => email.id === user.primaryEmailAddressId
    );

    const name =
      [user.firstName, user.lastName].filter(Boolean).join(" ") || null;

    return {
      id: user.id,
      email: primaryEmail?.emailAddress ?? "",
      name,
    };
  } catch (error) {
    logger.error({ error, clerkUserId }, "Failed to fetch user from Clerk API");
    return null;
  }
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}
