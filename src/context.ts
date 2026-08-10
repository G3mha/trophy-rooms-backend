import type { PrismaClient, User } from "@prisma/client";
import { UserRole } from "@prisma/client";
import { prisma } from "./lib/prisma.js";
import { extractBearerToken, verifySupabaseToken } from "./lib/supabase.js";
import { logger } from "./lib/logger.js";

export interface Context {
  prisma: PrismaClient;
  user: User | null;
  authUserId: string | null;
}

export async function createContext(request: Request): Promise<Context> {
  const authHeader = request.headers.get("authorization");
  const token = extractBearerToken(authHeader);

  let user: User | null = null;
  let authUserId: string | null = null;

  if (token) {
    const identity = await verifySupabaseToken(token);

    if (identity) {
      authUserId = identity.id;

      user = await prisma.user.findUnique({
        where: { supabaseId: identity.id },
      });

      // Migration adoption: a Supabase identity whose (verified) email matches
      // an account still keyed to its old Clerk id claims that account, so
      // returning users keep their data without any manual remapping.
      if (!user && identity.email) {
        const existing = await prisma.user.findUnique({
          where: { email: identity.email },
        });
        if (existing && existing.supabaseId.startsWith("user_")) {
          user = await prisma.user.update({
            where: { id: existing.id },
            data: { supabaseId: identity.id },
          });
          logger.info(
            { userId: user.id },
            "Adopted Clerk-era account for Supabase identity"
          );
        }
      }

      if (!user) {
        // Create user on first authentication
        try {
          user = await prisma.user.create({
            data: {
              supabaseId: identity.id,
              email: identity.email,
              name: identity.name,
            },
          });
          logger.info({ userId: user.id }, "Created new user");
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
