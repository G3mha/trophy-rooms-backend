import type { PrismaClient, User } from "@prisma/client";
import { UserRole } from "@prisma/client";
import { prisma } from "./lib/prisma.js";
import { verifyClerkToken, extractBearerToken } from "./lib/clerk.js";
import { logger } from "./lib/logger.js";

export interface Context {
  prisma: PrismaClient;
  user: User | null;
  clerkUserId: string | null;
}

export async function createContext(request: Request): Promise<Context> {
  const authHeader = request.headers.get("authorization");
  const token = extractBearerToken(authHeader);

  let user: User | null = null;
  let clerkUserId: string | null = null;

  if (token) {
    const clerkUser = await verifyClerkToken(token);

    if (clerkUser) {
      clerkUserId = clerkUser.id;

      // Find or create user in database
      user = await prisma.user.findUnique({
        where: { clerkId: clerkUser.id },
      });

      if (!user) {
        // Create user on first authentication
        try {
          user = await prisma.user.create({
            data: {
              clerkId: clerkUser.id,
              email: clerkUser.email,
              name: clerkUser.name,
            },
          });
          logger.info({ userId: user.id }, "Created new user from Clerk");
        } catch (error) {
          // Handle race condition - user might have been created by another request
          user = await prisma.user.findUnique({
            where: { clerkId: clerkUser.id },
          });
          if (!user) {
            logger.error({ error, clerkId: clerkUser.id }, "Failed to create user");
          }
        }
      }
    }
  }

  return {
    prisma,
    user,
    clerkUserId,
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
