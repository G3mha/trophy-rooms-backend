import type { PrismaClient, User } from "@prisma/client";
import { UserRole } from "@prisma/client";
import { prisma } from "./lib/prisma.js";
import {
  verifyClerkToken,
  extractBearerToken,
  fetchClerkUserData,
} from "./lib/clerk.js";
import { verifySupabaseToken } from "./lib/supabase.js";
import { logger } from "./lib/logger.js";

export interface Context {
  prisma: PrismaClient;
  user: User | null;
  authUserId: string | null;
}

interface AuthenticatedIdentity {
  id: string;
  email: string;
  name: string | null;
  provider: "supabase" | "clerk";
}

// Verifies the bearer token against Supabase first (target platform), then
// Clerk (legacy, kept during the migration window so existing sessions keep
// working). The User row is keyed by supabaseId, which holds a Clerk id for
// accounts that have not re-authenticated through Supabase yet.
async function resolveIdentity(
  token: string
): Promise<AuthenticatedIdentity | null> {
  const supabaseUser = await verifySupabaseToken(token);
  if (supabaseUser) {
    return { ...supabaseUser, provider: "supabase" };
  }

  const clerkUser = await verifyClerkToken(token);
  if (clerkUser) {
    return { ...clerkUser, provider: "clerk" };
  }

  return null;
}

export async function createContext(request: Request): Promise<Context> {
  const authHeader = request.headers.get("authorization");
  const token = extractBearerToken(authHeader);

  let user: User | null = null;
  let authUserId: string | null = null;

  if (token) {
    const identity = await resolveIdentity(token);

    if (identity) {
      authUserId = identity.id;

      user = await prisma.user.findUnique({
        where: { supabaseId: identity.id },
      });

      if (!user) {
        let email = identity.email;
        let name = identity.name;

        if (identity.provider === "clerk") {
          const fullClerkUser = await fetchClerkUserData(identity.id);
          if (fullClerkUser) {
            email = fullClerkUser.email;
            name = fullClerkUser.name;
          }
        }

        // Create user on first authentication
        try {
          user = await prisma.user.create({
            data: {
              supabaseId: identity.id,
              email,
              name,
            },
          });
          logger.info(
            { userId: user.id, provider: identity.provider },
            "Created new user"
          );
        } catch (error) {
          // Handle race condition - user might have been created by another request
          user = await prisma.user.findUnique({
            where: { supabaseId: identity.id },
          });
          if (!user) {
            logger.error(
              { error, authUserId: identity.id },
              "Failed to create user"
            );
          }
        }
      }
    }
  }

  return {
    prisma,
    user,
    authUserId,
  };
}

// Helper to require authentication in resolvers
export function requireAuth(context: Context): User {
  if (!context.user) {
    throw new Error("You must be logged in to perform this action");
  }
  return context.user;
}

const rolePriority: Record<UserRole, number> = {
  [UserRole.USER]: 1,
  [UserRole.TRUSTED]: 2,
  [UserRole.ADMIN]: 3,
};

export function hasRequiredRole(
  user: User | null,
  requiredRole: UserRole
): boolean {
  if (!user) return false;
  return rolePriority[user.role] >= rolePriority[requiredRole];
}
