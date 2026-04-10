import { Prisma, AchievementSetVisibility, UserRole, GameType } from "@prisma/client";
import { builder } from "../builder.js";
import { GamesFilterInput, GameOrderBy, GameTypeEnum } from "../types/game.js";
import { GameFamiliesFilterInput, GameFamilyOrderBy } from "../types/game-family.js";
import { hasRequiredRole } from "../../context.js";
import { searchGames, searchGameFamilies } from "../../lib/fulltext-search.js";

// Games connection with cursor-based pagination
builder.queryField("games", (t) =>
  t.prismaConnection({
    type: "Game",
    cursor: "id",
    args: {
      filter: t.arg({ type: GamesFilterInput }),
      orderBy: t.arg({ type: GameOrderBy }),
    },
    totalCount: async (_connection, args, ctx) => {
      const { filter } = args;
      const where: Prisma.GameWhereInput = {};
      const gameFamilyWhere: Prisma.GameFamilyWhereInput = {};

      // Use full-text search for better performance and relevance
      if (filter?.search) {
        const matchingIds = await searchGames(ctx.prisma, filter.search);
        if (matchingIds.length === 0) {
          return 0; // No matches found
        }
        where.id = { in: matchingIds };
      }

      if (filter?.platformId) {
        where.platformId = filter.platformId;
      }

      if (filter?.type) {
        gameFamilyWhere.type = filter.type;
      }

      if (filter?.isDerivative !== undefined) {
        gameFamilyWhere.baseGameFamilies = filter.isDerivative ? { some: {} } : { none: {} };
      }

      if (filter?.hasAchievements !== undefined) {
        const visibilityFilter = !ctx.user
          ? { visibility: AchievementSetVisibility.PUBLIC }
          : hasRequiredRole(ctx.user, UserRole.TRUSTED)
            ? {}
            : {
                OR: [
                  { visibility: AchievementSetVisibility.PUBLIC },
                  { createdByUserId: ctx.user.id },
                ],
              };

        gameFamilyWhere.achievementSets =
          filter.hasAchievements === true
            ? { some: visibilityFilter }
            : { none: visibilityFilter };
      }

      if (Object.keys(gameFamilyWhere).length > 0) {
        where.gameFamily = gameFamilyWhere;
      }

      return ctx.prisma.game.count({ where });
    },
    resolve: async (query, _root, args, ctx) => {
      const { filter, orderBy } = args;

      // Build where clause
      const where: Prisma.GameWhereInput = {};
      const gameFamilyWhere: Prisma.GameFamilyWhereInput = {};

      // Use full-text search for better performance and relevance
      if (filter?.search) {
        const matchingIds = await searchGames(ctx.prisma, filter.search);
        if (matchingIds.length === 0) {
          return []; // No matches found
        }
        where.id = { in: matchingIds };
      }

      if (filter?.hasAchievements !== undefined) {
        const visibilityFilter = !ctx.user
          ? { visibility: AchievementSetVisibility.PUBLIC }
          : hasRequiredRole(ctx.user, UserRole.TRUSTED)
            ? {}
            : {
                OR: [
                  { visibility: AchievementSetVisibility.PUBLIC },
                  { createdByUserId: ctx.user.id },
                ],
              };

        gameFamilyWhere.achievementSets =
          filter.hasAchievements === true
            ? { some: visibilityFilter }
            : { none: visibilityFilter };
      }

      if (filter?.platformId) {
        where.platformId = filter.platformId;
      }

      if (filter?.type) {
        gameFamilyWhere.type = filter.type;
      }

      if (filter?.isDerivative !== undefined) {
        gameFamilyWhere.baseGameFamilies = filter.isDerivative ? { some: {} } : { none: {} };
      }

      if (Object.keys(gameFamilyWhere).length > 0) {
        where.gameFamily = gameFamilyWhere;
      }

      // Build order by clause
      let orderByClause: Prisma.GameOrderByWithRelationInput;

      switch (orderBy) {
        case "TITLE_DESC":
          orderByClause = { gameFamily: { title: "desc" } };
          break;
        case "CREATED_AT_ASC":
          orderByClause = { createdAt: "asc" };
          break;
        case "CREATED_AT_DESC":
          orderByClause = { createdAt: "desc" };
          break;
        case "ACHIEVEMENT_COUNT_DESC":
          orderByClause = { gameFamily: { achievementSets: { _count: "desc" } } };
          break;
        case "TROPHY_COUNT_DESC":
          orderByClause = { trophies: { _count: "desc" } };
          break;
        case "TITLE_ASC":
        default:
          orderByClause = { gameFamily: { title: "asc" } };
          break;
      }

      return ctx.prisma.game.findMany({
        ...query,
        where,
        orderBy: orderByClause,
      });
    },
  })
);

// Admin games list with offset-based pagination (for page jumping)
const AdminGameItem = builder.objectRef<{
  id: string;
  gameFamilyId: string | null;
  title: string;
  description: string | null;
  coverUrl: string | null;
  type: GameType;
  baseGameFamilyIds: string[];
  platformId: string | null;
  platformName: string | null;
  platformSlug: string | null;
  achievementSetCount: number;
}>("AdminGameItem");

AdminGameItem.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    gameFamilyId: t.exposeString("gameFamilyId", { nullable: true }),
    title: t.exposeString("title"),
    description: t.exposeString("description", { nullable: true }),
    coverUrl: t.exposeString("coverUrl", { nullable: true }),
    type: t.field({
      type: GameTypeEnum,
      resolve: (game) => game.type,
    }),
    baseGameFamilyIds: t.exposeStringList("baseGameFamilyIds"),
    platformId: t.exposeString("platformId", { nullable: true }),
    platformName: t.exposeString("platformName", { nullable: true }),
    platformSlug: t.exposeString("platformSlug", { nullable: true }),
    achievementSetCount: t.exposeInt("achievementSetCount"),
  }),
});

const AdminGamesPage = builder.objectRef<{
  items: {
    id: string;
    gameFamilyId: string | null;
    title: string;
    description: string | null;
    coverUrl: string | null;
    type: GameType;
    baseGameFamilyIds: string[];
    platformId: string | null;
    platformName: string | null;
    platformSlug: string | null;
    achievementSetCount: number;
  }[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}>("AdminGamesPage");

AdminGamesPage.implement({
  fields: (t) => ({
    items: t.field({
      type: [AdminGameItem],
      resolve: (page) => page.items,
    }),
    totalCount: t.exposeInt("totalCount"),
    page: t.exposeInt("page"),
    pageSize: t.exposeInt("pageSize"),
    totalPages: t.exposeInt("totalPages"),
  }),
});

builder.queryField("adminGames", (t) =>
  t.field({
    type: AdminGamesPage,
    args: {
      page: t.arg.int({ required: false, defaultValue: 1 }),
      pageSize: t.arg.int({ required: false, defaultValue: 50 }),
      search: t.arg.string({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      const page = Math.max(1, args.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, args.pageSize ?? 50));
      const skip = (page - 1) * pageSize;

      const where: Prisma.GameWhereInput = {};

      // Use full-text search for better performance and relevance
      if (args.search) {
        const matchingIds = await searchGames(ctx.prisma, args.search);
        if (matchingIds.length === 0) {
          return {
            items: [],
            totalCount: 0,
            page,
            pageSize,
            totalPages: 0,
          };
        }
        where.id = { in: matchingIds };
      }

      const [games, totalCount] = await Promise.all([
        ctx.prisma.game.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: args.search ? undefined : { gameFamily: { title: "asc" } },
          include: {
            platform: true,
            gameFamily: {
              include: {
                baseGameFamilies: {
                  select: { id: true },
                },
                _count: {
                  select: { achievementSets: true },
                },
              },
            },
          },
        }),
        ctx.prisma.game.count({ where }),
      ]);

      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        items: games.map((game) => ({
          id: game.id,
          gameFamilyId: game.gameFamilyId,
          title: game.gameFamily?.title ?? "Unknown",
          description: game.gameFamily?.description ?? null,
          coverUrl: game.coverUrl ?? game.gameFamily?.coverUrl ?? null,
          type: game.gameFamily?.type ?? GameType.BASE_GAME,
          baseGameFamilyIds: game.gameFamily?.baseGameFamilies.map(bf => bf.id) ?? [],
          platformId: game.platform?.id ?? null,
          platformName: game.platform?.name ?? null,
          platformSlug: game.platform?.slug ?? null,
          achievementSetCount: game.gameFamily?._count.achievementSets ?? 0,
        })),
        totalCount,
        page,
        pageSize,
        totalPages,
      };
    },
  })
);

// User-facing games list with offset-based pagination
const GamePagePlatform = builder.objectRef<{
  id: string;
  name: string;
  slug: string;
}>("GamePagePlatform");

GamePagePlatform.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    name: t.exposeString("name"),
    slug: t.exposeString("slug"),
  }),
});

const GamePageItem = builder.objectRef<{
  id: string;
  gameFamilyId: string | null;
  title: string;
  description: string | null;
  coverUrl: string | null;
  type: GameType;
  baseGameFamilyIds: string[];
  platformId: string | null;
  platformName: string | null;
  platformSlug: string | null;
  achievementSetCount: number;
  achievementCount: number;
  trophyCount: number;
}>("GamePageItem");

GamePageItem.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    gameFamilyId: t.exposeString("gameFamilyId", { nullable: true }),
    title: t.exposeString("title"),
    description: t.exposeString("description", { nullable: true }),
    coverUrl: t.exposeString("coverUrl", { nullable: true }),
    type: t.field({
      type: GameTypeEnum,
      resolve: (game) => game.type,
    }),
    baseGameFamilyIds: t.exposeStringList("baseGameFamilyIds"),
    platform: t.field({
      type: GamePagePlatform,
      nullable: true,
      resolve: (game) => {
        if (!game.platformId || !game.platformName || !game.platformSlug) return null;
        return {
          id: game.platformId,
          name: game.platformName,
          slug: game.platformSlug,
        };
      },
    }),
    achievementSetCount: t.exposeInt("achievementSetCount"),
    achievementCount: t.exposeInt("achievementCount"),
    trophyCount: t.exposeInt("trophyCount"),
  }),
});

const GamesPage = builder.objectRef<{
  items: {
    id: string;
    gameFamilyId: string | null;
    title: string;
    description: string | null;
    coverUrl: string | null;
    type: GameType;
    baseGameFamilyIds: string[];
    platformId: string | null;
    platformName: string | null;
    platformSlug: string | null;
    achievementSetCount: number;
    achievementCount: number;
    trophyCount: number;
  }[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}>("GamesPage");

GamesPage.implement({
  fields: (t) => ({
    items: t.field({
      type: [GamePageItem],
      resolve: (page) => page.items,
    }),
    totalCount: t.exposeInt("totalCount"),
    page: t.exposeInt("page"),
    pageSize: t.exposeInt("pageSize"),
    totalPages: t.exposeInt("totalPages"),
  }),
});

builder.queryField("gamesPage", (t) =>
  t.field({
    type: GamesPage,
    args: {
      page: t.arg.int({ required: false, defaultValue: 1 }),
      pageSize: t.arg.int({ required: false, defaultValue: 25 }),
      filter: t.arg({ type: GamesFilterInput }),
      orderBy: t.arg({ type: GameOrderBy }),
    },
    resolve: async (_root, args, ctx) => {
      const page = Math.max(1, args.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, args.pageSize ?? 25));
      const skip = (page - 1) * pageSize;
      const { filter, orderBy } = args;

      // Build where clause
      const where: Prisma.GameWhereInput = {};
      let searchMatchingIds: string[] | null = null;

      // Use full-text search for better performance and relevance
      if (filter?.search) {
        searchMatchingIds = await searchGames(ctx.prisma, filter.search);
        if (searchMatchingIds.length === 0) {
          return {
            items: [],
            totalCount: 0,
            page,
            pageSize,
            totalPages: 0,
          };
        }
        where.id = { in: searchMatchingIds };
      }

      const gameFamilyWhere: Prisma.GameFamilyWhereInput = {};

      if (filter?.platformId) {
        where.platformId = filter.platformId;
      }

      if (filter?.type) {
        gameFamilyWhere.type = filter.type;
      }

      if (filter?.isDerivative !== undefined) {
        gameFamilyWhere.baseGameFamilies = filter.isDerivative ? { some: {} } : { none: {} };
      }

      if (filter?.hasAchievements !== undefined) {
        const visibilityFilter = !ctx.user
          ? { visibility: AchievementSetVisibility.PUBLIC }
          : hasRequiredRole(ctx.user, UserRole.TRUSTED)
            ? {}
            : {
                OR: [
                  { visibility: AchievementSetVisibility.PUBLIC },
                  { createdByUserId: ctx.user.id },
                ],
              };

        gameFamilyWhere.achievementSets =
          filter.hasAchievements === true
            ? { some: visibilityFilter }
            : { none: visibilityFilter };
      }

      if (Object.keys(gameFamilyWhere).length > 0) {
        where.gameFamily = gameFamilyWhere;
      }

      // Build order by clause
      let orderByClause: Prisma.GameOrderByWithRelationInput | undefined;

      // When searching without explicit orderBy, preserve relevance order
      if (!searchMatchingIds || orderBy) {
        switch (orderBy) {
          case "TITLE_DESC":
            orderByClause = { gameFamily: { title: "desc" } };
            break;
          case "CREATED_AT_ASC":
            orderByClause = { createdAt: "asc" };
            break;
          case "CREATED_AT_DESC":
            orderByClause = { createdAt: "desc" };
            break;
          case "ACHIEVEMENT_COUNT_DESC":
            orderByClause = { gameFamily: { achievementSets: { _count: "desc" } } };
            break;
          case "TROPHY_COUNT_DESC":
            orderByClause = { trophies: { _count: "desc" } };
            break;
          case "TITLE_ASC":
          default:
            orderByClause = { gameFamily: { title: "asc" } };
            break;
        }
      }

      const [games, totalCount] = await Promise.all([
        ctx.prisma.game.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: orderByClause,
          include: {
            platform: true,
            gameFamily: {
              include: {
                baseGameFamilies: {
                  select: { id: true },
                },
                _count: {
                  select: { achievementSets: true },
                },
                achievementSets: {
                  select: {
                    _count: {
                      select: { achievements: true },
                    },
                  },
                },
              },
            },
            _count: {
              select: {
                trophies: true,
              },
            },
          },
        }),
        ctx.prisma.game.count({ where }),
      ]);

      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        items: games.map((game) => ({
          id: game.id,
          gameFamilyId: game.gameFamilyId,
          title: game.gameFamily?.title ?? "Unknown",
          description: game.gameFamily?.description ?? null,
          coverUrl: game.coverUrl ?? game.gameFamily?.coverUrl ?? null,
          type: game.gameFamily?.type ?? GameType.BASE_GAME,
          baseGameFamilyIds: game.gameFamily?.baseGameFamilies.map(bf => bf.id) ?? [],
          platformId: game.platform?.id ?? null,
          platformName: game.platform?.name ?? null,
          platformSlug: game.platform?.slug ?? null,
          achievementSetCount: game.gameFamily?._count.achievementSets ?? 0,
          achievementCount: game.gameFamily?.achievementSets.reduce(
            (sum, set) => sum + set._count.achievements,
            0
          ) ?? 0,
          trophyCount: game._count.trophies,
        })),
        totalCount,
        page,
        pageSize,
        totalPages,
      };
    },
  })
);

// Single game query
builder.queryField("game", (t) =>
  t.prismaField({
    type: "Game",
    nullable: true,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      return ctx.prisma.game.findUnique({
        ...query,
        where: { id: args.id },
      });
    },
  })
);

// Games by title query - returns all games with matching title (case-insensitive)
// Deprecated: Use gameFamily or gameFamilyBySlug instead
builder.queryField("gamesByTitle", (t) =>
  t.field({
    type: [GamePageItem],
    deprecationReason: "Use gameFamily or gameFamilyBySlug instead",
    args: {
      title: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      // Find game family by title and return all its games
      const family = await ctx.prisma.gameFamily.findFirst({
        where: {
          title: {
            equals: args.title,
            mode: "insensitive",
          },
        },
        include: {
          games: {
            include: {
              platform: true,
              _count: {
                select: { trophies: true },
              },
            },
          },
          baseGameFamilies: {
            select: { id: true },
          },
          _count: {
            select: {
              achievementSets: true,
            },
          },
          achievementSets: {
            select: {
              _count: {
                select: { achievements: true },
              },
            },
          },
        },
      });

      if (!family) return [];

      return family.games.map((game) => ({
        id: game.id,
        gameFamilyId: family.id,
        title: family.title,
        description: family.description,
        coverUrl: game.coverUrl ?? family.coverUrl,
        type: family.type,
        baseGameFamilyIds: family.baseGameFamilies.map(bf => bf.id),
        platformId: game.platform?.id ?? null,
        platformName: game.platform?.name ?? null,
        platformSlug: game.platform?.slug ?? null,
        achievementSetCount: family._count.achievementSets,
        achievementCount: family.achievementSets.reduce(
          (sum, set) => sum + set._count.achievements,
          0
        ),
        trophyCount: game._count.trophies,
      }));
    },
  })
);

// ============================================================
// GameFamily Queries
// ============================================================

// Single game family by ID
builder.queryField("gameFamily", (t) =>
  t.prismaField({
    type: "GameFamily",
    nullable: true,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      return ctx.prisma.gameFamily.findUnique({
        ...query,
        where: { id: args.id },
      });
    },
  })
);

// Single game family by slug
builder.queryField("gameFamilyBySlug", (t) =>
  t.prismaField({
    type: "GameFamily",
    nullable: true,
    args: {
      slug: t.arg.string({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      return ctx.prisma.gameFamily.findUnique({
        ...query,
        where: { slug: args.slug },
      });
    },
  })
);

// Game families page item type
const GameFamilyPagePlatform = builder.objectRef<{
  id: string;
  name: string;
  slug: string;
}>("GameFamilyPagePlatform");

GameFamilyPagePlatform.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    name: t.exposeString("name"),
    slug: t.exposeString("slug"),
  }),
});

const GameFamilyPageItem = builder.objectRef<{
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  type: GameType;
  baseGameFamilyIds: string[];
  platforms: { id: string; name: string; slug: string }[];
  achievementSetCount: number;
  achievementCount: number;
  totalTrophyCount: number;
  gameCount: number;
}>("GameFamilyPageItem");

GameFamilyPageItem.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    title: t.exposeString("title"),
    slug: t.exposeString("slug"),
    description: t.exposeString("description", { nullable: true }),
    coverUrl: t.exposeString("coverUrl", { nullable: true }),
    type: t.field({
      type: GameTypeEnum,
      resolve: (family) => family.type,
    }),
    baseGameFamilyIds: t.exposeStringList("baseGameFamilyIds"),
    platforms: t.field({
      type: [GameFamilyPagePlatform],
      resolve: (family) => family.platforms,
    }),
    achievementSetCount: t.exposeInt("achievementSetCount"),
    achievementCount: t.exposeInt("achievementCount"),
    totalTrophyCount: t.exposeInt("totalTrophyCount"),
    gameCount: t.exposeInt("gameCount"),
  }),
});

const GameFamiliesPage = builder.objectRef<{
  items: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    coverUrl: string | null;
    type: GameType;
    baseGameFamilyIds: string[];
    platforms: { id: string; name: string; slug: string }[];
    achievementSetCount: number;
    achievementCount: number;
    totalTrophyCount: number;
    gameCount: number;
  }[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}>("GameFamiliesPage");

GameFamiliesPage.implement({
  fields: (t) => ({
    items: t.field({
      type: [GameFamilyPageItem],
      resolve: (page) => page.items,
    }),
    totalCount: t.exposeInt("totalCount"),
    page: t.exposeInt("page"),
    pageSize: t.exposeInt("pageSize"),
    totalPages: t.exposeInt("totalPages"),
  }),
});

// Game families page query with offset-based pagination
builder.queryField("gameFamiliesPage", (t) =>
  t.field({
    type: GameFamiliesPage,
    args: {
      page: t.arg.int({ required: false, defaultValue: 1 }),
      pageSize: t.arg.int({ required: false, defaultValue: 25 }),
      filter: t.arg({ type: GameFamiliesFilterInput }),
      orderBy: t.arg({ type: GameFamilyOrderBy }),
    },
    resolve: async (_root, args, ctx) => {
      const page = Math.max(1, args.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, args.pageSize ?? 25));
      const skip = (page - 1) * pageSize;
      const { filter, orderBy } = args;

      // Build where clause
      const where: Prisma.GameFamilyWhereInput = {};
      let searchMatchingIds: string[] | null = null;

      // Use search for title matching
      if (filter?.search) {
        searchMatchingIds = await searchGameFamilies(ctx.prisma, filter.search);
        if (searchMatchingIds.length === 0) {
          return {
            items: [],
            totalCount: 0,
            page,
            pageSize,
            totalPages: 0,
          };
        }
        where.id = { in: searchMatchingIds };
      }

      if (filter?.platformId) {
        where.games = { some: { platformId: filter.platformId } };
      }

      if (filter?.type) {
        where.type = filter.type;
      }

      if (filter?.isDerivative !== undefined) {
        where.baseGameFamilies = filter.isDerivative ? { some: {} } : { none: {} };
      }

      if (filter?.hasAchievements !== undefined) {
        const visibilityFilter = !ctx.user
          ? { visibility: AchievementSetVisibility.PUBLIC }
          : hasRequiredRole(ctx.user, UserRole.TRUSTED)
            ? {}
            : {
                OR: [
                  { visibility: AchievementSetVisibility.PUBLIC },
                  { createdByUserId: ctx.user.id },
                ],
              };

        where.achievementSets =
          filter.hasAchievements === true
            ? { some: visibilityFilter }
            : { none: visibilityFilter };
      }

      // Build order by clause
      let orderByClause: Prisma.GameFamilyOrderByWithRelationInput | undefined;

      if (!searchMatchingIds || orderBy) {
        switch (orderBy) {
          case "TITLE_DESC":
            orderByClause = { title: "desc" };
            break;
          case "CREATED_AT_ASC":
            orderByClause = { createdAt: "asc" };
            break;
          case "CREATED_AT_DESC":
            orderByClause = { createdAt: "desc" };
            break;
          case "ACHIEVEMENT_COUNT_DESC":
            orderByClause = { achievementSets: { _count: "desc" } };
            break;
          case "TROPHY_COUNT_DESC":
          case "PLATFORM_COUNT_DESC":
            orderByClause = { games: { _count: "desc" } };
            break;
          case "TITLE_ASC":
          default:
            orderByClause = { title: "asc" };
            break;
        }
      }

      const [families, totalCount] = await Promise.all([
        ctx.prisma.gameFamily.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: orderByClause,
          include: {
            games: {
              include: {
                platform: true,
              },
            },
            baseGameFamilies: {
              select: { id: true },
            },
            _count: {
              select: {
                achievementSets: true,
                games: true,
              },
            },
            achievementSets: {
              select: {
                _count: {
                  select: { achievements: true },
                },
              },
            },
          },
        }),
        ctx.prisma.gameFamily.count({ where }),
      ]);

      const totalPages = Math.ceil(totalCount / pageSize);

      // Get trophy counts per family
      const familyIds = families.map(f => f.id);
      const trophyCounts = await ctx.prisma.trophy.groupBy({
        by: ["gameId"],
        where: {
          game: {
            gameFamilyId: { in: familyIds },
          },
        },
        _count: true,
      });

      // Map gameId to gameFamilyId for trophy counts
      const gameToFamily = new Map<string, string>();
      families.forEach(f => {
        f.games.forEach(g => {
          gameToFamily.set(g.id, f.id);
        });
      });

      const familyTrophyCounts = new Map<string, number>();
      trophyCounts.forEach(tc => {
        const familyId = gameToFamily.get(tc.gameId);
        if (familyId) {
          familyTrophyCounts.set(
            familyId,
            (familyTrophyCounts.get(familyId) || 0) + tc._count
          );
        }
      });

      return {
        items: families.map((family) => {
          // Get unique platforms
          const platformMap = new Map<string, { id: string; name: string; slug: string }>();
          family.games.forEach(game => {
            if (game.platform) {
              platformMap.set(game.platform.id, {
                id: game.platform.id,
                name: game.platform.name,
                slug: game.platform.slug,
              });
            }
          });

          return {
            id: family.id,
            title: family.title,
            slug: family.slug,
            description: family.description,
            coverUrl: family.coverUrl,
            type: family.type,
            baseGameFamilyIds: family.baseGameFamilies.map(bf => bf.id),
            platforms: Array.from(platformMap.values()),
            achievementSetCount: family._count.achievementSets,
            achievementCount: family.achievementSets.reduce(
              (sum, set) => sum + set._count.achievements,
              0
            ),
            totalTrophyCount: familyTrophyCounts.get(family.id) || 0,
            gameCount: family._count.games,
          };
        }),
        totalCount,
        page,
        pageSize,
        totalPages,
      };
    },
  })
);
