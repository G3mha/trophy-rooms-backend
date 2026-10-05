import {
  AchievementSetType,
  AchievementSetVisibility,
  UserRole,
  type Prisma,
  type User,
} from "@prisma/client";
import { hasRequiredRole } from "../context.js";

/**
 * Achievement sets anyone can see: every official and completionist set, and
 * custom sets their creator has published. Visibility only means something
 * for custom sets, since every other type is created public.
 */
export const publicSetWhere = {
  OR: [
    { type: { not: AchievementSetType.CUSTOM } },
    { visibility: AchievementSetVisibility.PUBLIC },
  ],
} satisfies Prisma.AchievementSetWhereInput;

/**
 * Achievement sets a viewer can see. Private custom sets are personal
 * checklists, so only their creator sees them. Trusted users and admins see
 * every set so they can moderate.
 *
 * Combine with other conditions through `AND`, since the result may carry its
 * own `OR`.
 */
export function visibleSetWhere(user: User | null): Prisma.AchievementSetWhereInput {
  if (hasRequiredRole(user, UserRole.TRUSTED)) return {};
  if (!user) return publicSetWhere;
  return { OR: [...publicSetWhere.OR, { createdByUserId: user.id }] };
}
