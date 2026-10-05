import {
  AchievementSetType,
  AchievementSetVisibility,
  type Prisma,
} from "@prisma/client";

/**
 * Achievement sets that count towards a game's trophy: official and
 * completionist sets, plus custom sets their creator has made public.
 * Private custom sets are personal checklists, so they neither gate a trophy
 * nor count in progress towards one.
 */
export const trophyEligibleSetWhere = {
  OR: [
    { type: { in: [AchievementSetType.OFFICIAL, AchievementSetType.COMPLETIONIST] } },
    { type: AchievementSetType.CUSTOM, visibility: AchievementSetVisibility.PUBLIC },
  ],
} satisfies Prisma.AchievementSetWhereInput;
