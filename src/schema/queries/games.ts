import { Prisma, AchievementSetVisibility, UserRole, GameType } from "@prisma/client";
import { builder } from "../builder.js";
import { GamesFilterInput, GameOrderBy, GameTypeEnum } from "../types/game.js";
import { hasRequiredRole } from "../../context.js";

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

      if (filter?.search) {
        where.OR = [
          { title: { contains: filter.search, mode: "insensitive" } },
          { description: { contains: filter.search, mode: "insensitive" } },
        ];
      }

      if (filter?.platformId) {
        where.platformId = filter.platformId;
      }

      if (filter?.type) {
        where.type = filter.type;
      }

      if (filter?.isDerivative !== undefined) {
        where.baseGameId = filter.isDerivative ? { not: null } : null;
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

      return ctx.prisma.game.count({ where });
    },
    resolve: async (query, _root, args, ctx) => {
      const { filter, orderBy } = args;

      // Build where clause
      const where: Prisma.GameWhereInput = {};

      if (filter?.search) {
        where.OR = [
          { title: { contains: filter.search, mode: "insensitive" } },
          { description: { contains: filter.search, mode: "insensitive" } },
        ];
      }

      if (filter?.hasAchievements === true) {
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

        where.achievementSets = { some: visibilityFilter };
      } else if (filter?.hasAchievements === false) {
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

        where.achievementSets = { none: visibilityFilter };
      }

      if (filter?.platformId) {
        where.platformId = filter.platformId;
      }

      if (filter?.type) {
        where.type = filter.type;
      }

      if (filter?.isDerivative !== undefined) {
        where.baseGameId = filter.isDerivative ? { not: null } : null;
      }

      // Build order by clause
      let orderByClause: Prisma.GameOrderByWithRelationInput;

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
          // Falling back to achievement set count since simple achievement count is complex
          orderByClause = { achievementSets: { _count: "desc" } };
          break;
        case "TROPHY_COUNT_DESC":
          orderByClause = { trophies: { _count: "desc" } };
          break;
        case "TITLE_ASC":
        default:
          orderByClause = { title: "asc" };
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
  title: string;
  description: string | null;
  coverUrl: string | null;
  type: GameType;
  baseGameId: string | null;
  platformId: string | null;
  platformName: string | null;
  platformSlug: string | null;
  achievementSetCount: number;
}>("AdminGameItem");

AdminGameItem.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    title: t.exposeString("title"),
    description: t.exposeString("description", { nullable: true }),
    coverUrl: t.exposeString("coverUrl", { nullable: true }),
    type: t.field({
      type: GameTypeEnum,
      resolve: (game) => game.type,
    }),
    baseGameId: t.exposeString("baseGameId", { nullable: true }),
    platformId: t.exposeString("platformId", { nullable: true }),
    platformName: t.exposeString("platformName", { nullable: true }),
    platformSlug: t.exposeString("platformSlug", { nullable: true }),
    achievementSetCount: t.exposeInt("achievementSetCount"),
  }),
});

const AdminGamesPage = builder.objectRef<{
  items: {
    id: string;
    title: string;
    description: string | null;
    coverUrl: string | null;
    type: GameType;
    baseGameId: string | null;
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

      if (args.search) {
        where.OR = [
          { title: { contains: args.search, mode: "insensitive" } },
          { description: { contains: args.search, mode: "insensitive" } },
        ];
      }

      const [games, totalCount] = await Promise.all([
        ctx.prisma.game.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { title: "asc" },
          include: {
            platform: true,
            _count: {
              select: { achievementSets: true },
            },
          },
        }),
        ctx.prisma.game.count({ where }),
      ]);

      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        items: games.map((game) => ({
          id: game.id,
          title: game.title,
          description: game.description,
          coverUrl: game.coverUrl,
          type: game.type,
          baseGameId: game.baseGameId,
          platformId: game.platform?.id ?? null,
          platformName: game.platform?.name ?? null,
          platformSlug: game.platform?.slug ?? null,
          achievementSetCount: game._count.achievementSets,
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
  title: string;
  description: string | null;
  coverUrl: string | null;
  type: GameType;
  baseGameId: string | null;
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
    title: t.exposeString("title"),
    description: t.exposeString("description", { nullable: true }),
    coverUrl: t.exposeString("coverUrl", { nullable: true }),
    type: t.field({
      type: GameTypeEnum,
      resolve: (game) => game.type,
    }),
    baseGameId: t.exposeString("baseGameId", { nullable: true }),
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
    title: string;
    description: string | null;
    coverUrl: string | null;
    type: GameType;
    baseGameId: string | null;
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

      if (filter?.search) {
        where.OR = [
          { title: { contains: filter.search, mode: "insensitive" } },
          { description: { contains: filter.search, mode: "insensitive" } },
        ];
      }

      if (filter?.platformId) {
        where.platformId = filter.platformId;
      }

      if (filter?.type) {
        where.type = filter.type;
      }

      if (filter?.isDerivative !== undefined) {
        where.baseGameId = filter.isDerivative ? { not: null } : null;
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
      let orderByClause: Prisma.GameOrderByWithRelationInput;

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
          orderByClause = { trophies: { _count: "desc" } };
          break;
        case "TITLE_ASC":
        default:
          orderByClause = { title: "asc" };
          break;
      }

      const [games, totalCount] = await Promise.all([
        ctx.prisma.game.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: orderByClause,
          include: {
            platform: true,
            _count: {
              select: {
                achievementSets: true,
                trophies: true,
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
        ctx.prisma.game.count({ where }),
      ]);

      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        items: games.map((game) => ({
          id: game.id,
          title: game.title,
          description: game.description,
          coverUrl: game.coverUrl,
          type: game.type,
          baseGameId: game.baseGameId,
          platformId: game.platform?.id ?? null,
          platformName: game.platform?.name ?? null,
          platformSlug: game.platform?.slug ?? null,
          achievementSetCount: game._count.achievementSets,
          achievementCount: game.achievementSets.reduce(
            (sum, set) => sum + set._count.achievements,
            0
          ),
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
builder.queryField("gamesByTitle", (t) =>
  t.field({
    type: [GamePageItem],
    args: {
      title: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const games = await ctx.prisma.game.findMany({
        where: {
          title: {
            equals: args.title,
            mode: "insensitive",
          },
        },
        include: {
          platform: true,
          _count: {
            select: {
              achievementSets: true,
              trophies: true,
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
        orderBy: { platform: { name: "asc" } },
      });

      return games.map((game) => ({
        id: game.id,
        title: game.title,
        description: game.description,
        coverUrl: game.coverUrl,
        type: game.type,
        baseGameId: game.baseGameId,
        platformId: game.platform?.id ?? null,
        platformName: game.platform?.name ?? null,
        platformSlug: game.platform?.slug ?? null,
        achievementSetCount: game._count.achievementSets,
        achievementCount: game.achievementSets.reduce(
          (sum, set) => sum + set._count.achievements,
          0
        ),
        trophyCount: game._count.trophies,
      }));
    },
  })
);
