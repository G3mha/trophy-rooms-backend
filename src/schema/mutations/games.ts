import { builder, BulkDeleteResultRef } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";
import {
  CreateGameInput,
  UpdateGameInput,
  GameMutationResult,
  DeleteGameResult,
  AddPlatformToGameFamilyInput,
} from "../types/game.js";
import {
  CreateGameFamilyInput,
  UpdateGameFamilyInput,
  GameFamilyMutationResult,
  DeleteGameFamilyResult,
} from "../types/game-family.js";
import { hasRequiredRole } from "../../context.js";
import { UserRole, GameType } from "@prisma/client";
import { invalidateGameCaches } from "../../lib/cache.js";

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);
}

// Create game mutation - creates both GameFamily and Game (platform instance)
builder.mutationField("createGame", (t) =>
  t.field({
    type: GameMutationResult,
    args: {
      input: t.arg({ type: CreateGameInput, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          gameId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to create a game",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          gameId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to create games",
            field: null,
          },
        };
      }

      const {
        title,
        description,
        coverUrl,
        releaseDate,
        developer,
        publisher,
        genre,
        esrbRating,
        screenshots,
        type,
        baseGameFamilyIds,
        platformReleaseDate,
        platformCoverUrl,
      } = args.input;
      const platformId = args.input.platformId ?? null;
      const gameType = type ?? GameType.BASE_GAME;

      // Validate title
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        return {
          success: false,
          gameId: null,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "Title is required",
            field: "title",
          },
        };
      }

      // Generate slug for the game family
      const baseSlug = generateSlug(trimmedTitle);
      let slug = baseSlug;
      let counter = 1;
      while (await ctx.prisma.gameFamily.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      // Check for existing game family + platform combination
      if (platformId) {
        const existingFamily = await ctx.prisma.gameFamily.findFirst({
          where: { title: { equals: trimmedTitle, mode: "insensitive" } },
          include: { games: { where: { platformId } } },
        });

        if (existingFamily && existingFamily.games.length > 0) {
          return {
            success: false,
            gameId: null,
            error: {
              code: ErrorCode.ALREADY_EXISTS,
              message: `A game with title "${trimmedTitle}" already exists on this platform`,
              field: "title",
            },
          };
        }
      }

      // Validate baseGameFamilyIds if provided
      if (baseGameFamilyIds && baseGameFamilyIds.length > 0) {
        const baseFamilies = await ctx.prisma.gameFamily.findMany({
          where: { id: { in: baseGameFamilyIds } },
          select: { id: true },
        });

        const foundIds = new Set(baseFamilies.map(f => f.id));
        const missingIds = baseGameFamilyIds.filter(id => !foundIds.has(id));

        if (missingIds.length > 0) {
          return {
            success: false,
            gameId: null,
            error: {
              code: ErrorCode.NOT_FOUND,
              message: `Base game family(ies) not found: ${missingIds.join(", ")}`,
              field: "baseGameFamilyIds",
            },
          };
        }
      }

      // Create the GameFamily
      const gameFamily = await ctx.prisma.gameFamily.create({
        data: {
          title: trimmedTitle,
          slug,
          description: description?.trim() || null,
          coverUrl: coverUrl?.trim() || null,
          releaseDate: releaseDate ?? null,
          developer: developer?.trim() || null,
          publisher: publisher?.trim() || null,
          genre: genre?.trim() || null,
          esrbRating: esrbRating?.trim() || null,
          screenshots: screenshots ?? [],
          type: gameType,
          baseGameFamilies: baseGameFamilyIds && baseGameFamilyIds.length > 0
            ? { connect: baseGameFamilyIds.map(id => ({ id })) }
            : undefined,
        },
      });

      // Create the Game (platform instance)
      const game = await ctx.prisma.game.create({
        data: {
          gameFamilyId: gameFamily.id,
          platformId,
          releaseDate: platformReleaseDate ?? releaseDate ?? null,
          coverUrl: platformCoverUrl?.trim() || null,
        },
      });

      // Check if a "Standard" version already exists (shared)
      const existingStandard = await ctx.prisma.gameVersion.findUnique({
        where: { slug: "standard" },
      });

      // Connect to Standard version using raw SQL to avoid transaction/pooler issues
      if (existingStandard) {
        await ctx.prisma.$executeRaw`
          INSERT INTO "_GameVersionGames" ("A", "B")
          VALUES (${game.id}, ${existingStandard.id})
          ON CONFLICT DO NOTHING
        `;
      } else {
        // Create new Standard version and connect via raw SQL
        const newVersion = await ctx.prisma.gameVersion.create({
          data: {
            name: "Standard",
            slug: "standard",
            isDefault: true,
          },
        });
        await ctx.prisma.$executeRaw`
          INSERT INTO "_GameVersionGames" ("A", "B")
          VALUES (${game.id}, ${newVersion.id})
          ON CONFLICT DO NOTHING
        `;
      }

      // Invalidate game caches after successful creation
      invalidateGameCaches().catch(() => {});

      return {
        success: true,
        gameId: game.id,
        error: null,
      };
    },
  })
);

// Update game mutation - updates both Game and its GameFamily
builder.mutationField("updateGame", (t) =>
  t.field({
    type: GameMutationResult,
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: UpdateGameInput, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          gameId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to update a game",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          gameId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to update games",
            field: null,
          },
        };
      }

      const { id, input } = args;

      // Check if game exists
      const existing = await ctx.prisma.game.findUnique({
        where: { id },
        include: { gameFamily: true },
      });

      if (!existing) {
        return {
          success: false,
          gameId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Game with id "${id}" not found`,
            field: null,
          },
        };
      }

      // Build update data for GameFamily
      const familyUpdateData: {
        title?: string;
        slug?: string;
        description?: string | null;
        coverUrl?: string | null;
        releaseDate?: Date | null;
        developer?: string | null;
        publisher?: string | null;
        genre?: string | null;
        esrbRating?: string | null;
        screenshots?: string[];
        type?: GameType;
        baseGameFamilies?: { set: { id: string }[] };
      } = {};

      // Build update data for Game
      const gameUpdateData: {
        platformId?: string | null;
        releaseDate?: Date | null;
        coverUrl?: string | null;
      } = {};

      if (input.title !== undefined && input.title !== null) {
        const trimmedTitle = input.title.trim();
        if (!trimmedTitle) {
          return {
            success: false,
            gameId: null,
            error: {
              code: ErrorCode.VALIDATION_ERROR,
              message: "Title cannot be empty",
              field: "title",
            },
          };
        }
        familyUpdateData.title = trimmedTitle;

        // Update slug if title changes
        if (existing.gameFamily && trimmedTitle !== existing.gameFamily.title) {
          const baseSlug = generateSlug(trimmedTitle);
          let slug = baseSlug;
          let counter = 1;
          while (await ctx.prisma.gameFamily.findFirst({
            where: { slug, id: { not: existing.gameFamilyId ?? undefined } },
          })) {
            slug = `${baseSlug}-${counter}`;
            counter++;
          }
          familyUpdateData.slug = slug;
        }
      }

      if (input.description !== undefined) {
        familyUpdateData.description = input.description?.trim() || null;
      }

      if (input.coverUrl !== undefined) {
        familyUpdateData.coverUrl = input.coverUrl?.trim() || null;
      }

      if (input.releaseDate !== undefined) {
        familyUpdateData.releaseDate = input.releaseDate ?? null;
      }

      if (input.developer !== undefined) {
        familyUpdateData.developer = input.developer?.trim() || null;
      }

      if (input.publisher !== undefined) {
        familyUpdateData.publisher = input.publisher?.trim() || null;
      }

      if (input.genre !== undefined) {
        familyUpdateData.genre = input.genre?.trim() || null;
      }

      if (input.esrbRating !== undefined) {
        familyUpdateData.esrbRating = input.esrbRating?.trim() || null;
      }

      if (input.screenshots !== undefined) {
        familyUpdateData.screenshots = input.screenshots ?? [];
      }

      if (input.type !== undefined && input.type !== null) {
        familyUpdateData.type = input.type;
      }

      if (input.baseGameFamilyIds !== undefined) {
        // Validate baseGameFamilyIds if not empty
        if (input.baseGameFamilyIds !== null && input.baseGameFamilyIds.length > 0) {
          // Prevent self-reference
          if (existing.gameFamilyId && input.baseGameFamilyIds.includes(existing.gameFamilyId)) {
            return {
              success: false,
              gameId: null,
              error: {
                code: ErrorCode.VALIDATION_ERROR,
                message: "A game family cannot be its own base",
                field: "baseGameFamilyIds",
              },
            };
          }

          const baseFamilies = await ctx.prisma.gameFamily.findMany({
            where: { id: { in: input.baseGameFamilyIds } },
            select: { id: true },
          });

          const foundIds = new Set(baseFamilies.map(f => f.id));
          const missingIds = input.baseGameFamilyIds.filter(fId => !foundIds.has(fId));

          if (missingIds.length > 0) {
            return {
              success: false,
              gameId: null,
              error: {
                code: ErrorCode.NOT_FOUND,
                message: `Base game family(ies) not found: ${missingIds.join(", ")}`,
                field: "baseGameFamilyIds",
              },
            };
          }
        }
        familyUpdateData.baseGameFamilies = {
          set: (input.baseGameFamilyIds ?? []).map(fId => ({ id: fId })),
        };
      }

      // Game-specific updates
      if (input.platformId !== undefined) {
        // Check for duplicate platform in family
        if (existing.gameFamilyId) {
          const duplicate = await ctx.prisma.game.findFirst({
            where: {
              gameFamilyId: existing.gameFamilyId,
              platformId: input.platformId,
              id: { not: id },
            },
          });

          if (duplicate) {
            return {
              success: false,
              gameId: null,
              error: {
                code: ErrorCode.ALREADY_EXISTS,
                message: "This game already exists on the target platform",
                field: "platformId",
              },
            };
          }
        }
        gameUpdateData.platformId = input.platformId ?? null;
      }

      if (input.platformReleaseDate !== undefined) {
        gameUpdateData.releaseDate = input.platformReleaseDate ?? null;
      }

      if (input.platformCoverUrl !== undefined) {
        gameUpdateData.coverUrl = input.platformCoverUrl?.trim() || null;
      }

      // Update GameFamily if there are family updates
      if (existing.gameFamilyId && Object.keys(familyUpdateData).length > 0) {
        await ctx.prisma.gameFamily.update({
          where: { id: existing.gameFamilyId },
          data: familyUpdateData,
        });
      }

      // Update Game
      const game = await ctx.prisma.game.update({
        where: { id },
        data: gameUpdateData,
      });

      // Invalidate game caches after successful update
      invalidateGameCaches().catch(() => {});

      return {
        success: true,
        gameId: game.id,
        error: null,
      };
    },
  })
);

// Delete game mutation
builder.mutationField("deleteGame", (t) =>
  t.field({
    type: DeleteGameResult,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          deletedId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to delete a game",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          deletedId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to delete games",
            field: null,
          },
        };
      }

      const { id } = args;

      // Check if game exists
      const existing = await ctx.prisma.game.findUnique({
        where: { id },
      });

      if (!existing) {
        return {
          success: false,
          deletedId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Game with id "${id}" not found`,
            field: null,
          },
        };
      }

      // Delete game (cascade will delete related records)
      await ctx.prisma.game.delete({
        where: { id },
      });

      // Invalidate game caches after successful deletion
      invalidateGameCaches().catch(() => {});

      return {
        success: true,
        deletedId: id,
        error: null,
      };
    },
  })
);

// Add platform to existing game family (replaces cloneGameToPlatform)
builder.mutationField("addPlatformToGameFamily", (t) =>
  t.field({
    type: GameMutationResult,
    args: {
      input: t.arg({ type: AddPlatformToGameFamilyInput, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          gameId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to add a platform",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          gameId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to add platforms",
            field: null,
          },
        };
      }

      const { gameFamilyId, platformId, releaseDate, coverUrl } = args.input;

      // Verify game family exists
      const gameFamily = await ctx.prisma.gameFamily.findUnique({
        where: { id: gameFamilyId },
      });

      if (!gameFamily) {
        return {
          success: false,
          gameId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Game family with id "${gameFamilyId}" not found`,
            field: "gameFamilyId",
          },
        };
      }

      // Verify platform exists
      const platform = await ctx.prisma.platform.findUnique({
        where: { id: platformId },
      });

      if (!platform) {
        return {
          success: false,
          gameId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Platform with id "${platformId}" not found`,
            field: "platformId",
          },
        };
      }

      // Check if game already exists on this platform
      const existing = await ctx.prisma.game.findFirst({
        where: {
          gameFamilyId,
          platformId,
        },
      });

      if (existing) {
        return {
          success: false,
          gameId: null,
          error: {
            code: ErrorCode.ALREADY_EXISTS,
            message: `"${gameFamily.title}" already exists on ${platform.name}`,
            field: "platformId",
          },
        };
      }

      // Find or create Standard version
      let standardVersion = await ctx.prisma.gameVersion.findFirst({
        where: { slug: "standard" },
      });

      if (!standardVersion) {
        standardVersion = await ctx.prisma.gameVersion.create({
          data: {
            name: "Standard",
            slug: "standard",
            isDefault: true,
          },
        });
      }

      // Create new game entry
      const newGame = await ctx.prisma.game.create({
        data: {
          gameFamilyId,
          platformId,
          releaseDate: releaseDate ?? null,
          coverUrl: coverUrl?.trim() || null,
          versions: {
            connect: { id: standardVersion.id },
          },
        },
      });

      // Invalidate game caches after successful creation
      invalidateGameCaches().catch(() => {});

      return {
        success: true,
        gameId: newGame.id,
        error: null,
      };
    },
  })
);

// Deprecated: Clone game to another platform (use addPlatformToGameFamily instead)
builder.mutationField("cloneGameToPlatform", (t) =>
  t.field({
    type: GameMutationResult,
    deprecationReason: "Use addPlatformToGameFamily instead",
    args: {
      gameId: t.arg.id({ required: true }),
      targetPlatformId: t.arg.id({ required: true }),
      copyAchievementSets: t.arg.boolean({ required: false, defaultValue: false }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          gameId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to clone a game",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          gameId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to clone games",
            field: null,
          },
        };
      }

      const { gameId, targetPlatformId } = args;

      // Get source game
      const sourceGame = await ctx.prisma.game.findUnique({
        where: { id: gameId },
        include: { gameFamily: true },
      });

      if (!sourceGame) {
        return {
          success: false,
          gameId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Game with id "${gameId}" not found`,
            field: "gameId",
          },
        };
      }

      if (!sourceGame.gameFamilyId) {
        return {
          success: false,
          gameId: null,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "Source game has no associated game family",
            field: "gameId",
          },
        };
      }

      // Verify target platform exists
      const targetPlatform = await ctx.prisma.platform.findUnique({
        where: { id: targetPlatformId },
      });

      if (!targetPlatform) {
        return {
          success: false,
          gameId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Platform with id "${targetPlatformId}" not found`,
            field: "targetPlatformId",
          },
        };
      }

      // Check if game already exists on target platform
      const existing = await ctx.prisma.game.findFirst({
        where: {
          gameFamilyId: sourceGame.gameFamilyId,
          platformId: targetPlatformId,
        },
      });

      if (existing) {
        return {
          success: false,
          gameId: null,
          error: {
            code: ErrorCode.ALREADY_EXISTS,
            message: `"${sourceGame.gameFamily?.title}" already exists on ${targetPlatform.name}`,
            field: "targetPlatformId",
          },
        };
      }

      // Find or create Standard version
      let standardVersion = await ctx.prisma.gameVersion.findFirst({
        where: { slug: "standard" },
      });

      if (!standardVersion) {
        standardVersion = await ctx.prisma.gameVersion.create({
          data: {
            name: "Standard",
            slug: "standard",
            isDefault: true,
          },
        });
      }

      // Create new game entry linked to the same family
      const newGame = await ctx.prisma.game.create({
        data: {
          gameFamilyId: sourceGame.gameFamilyId,
          platformId: targetPlatformId,
          releaseDate: null,
          coverUrl: null,
          versions: {
            connect: { id: standardVersion.id },
          },
        },
      });

      // Invalidate game caches after successful clone
      invalidateGameCaches().catch(() => {});

      return {
        success: true,
        gameId: newGame.id,
        error: null,
      };
    },
  })
);

// Bulk delete games mutation
builder.mutationField("bulkDeleteGames", (t) =>
  t.field({
    type: BulkDeleteResultRef,
    args: {
      ids: t.arg.idList({ required: true }),
    },
    resolve: async (_root, { ids }, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          deletedCount: 0,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to delete games",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          deletedCount: 0,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to delete games",
            field: null,
          },
        };
      }

      if (ids.length === 0) {
        return {
          success: false,
          deletedCount: 0,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "At least one game ID is required",
            field: "ids",
          },
        };
      }

      const result = await ctx.prisma.game.deleteMany({
        where: { id: { in: ids } },
      });

      // Invalidate game caches after successful bulk delete
      invalidateGameCaches().catch(() => {});

      return {
        success: true,
        deletedCount: result.count,
        error: null,
      };
    },
  })
);

// ============================================================
// GameFamily Mutations
// ============================================================

// Create game family mutation
builder.mutationField("createGameFamily", (t) =>
  t.field({
    type: GameFamilyMutationResult,
    args: {
      input: t.arg({ type: CreateGameFamilyInput, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          gameFamilyId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to create a game family",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          gameFamilyId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to create game families",
            field: null,
          },
        };
      }

      const {
        title,
        slug: inputSlug,
        description,
        coverUrl,
        releaseDate,
        developer,
        publisher,
        genre,
        esrbRating,
        screenshots,
        type,
        baseGameFamilyIds,
        platformIds,
      } = args.input;

      // Validate title
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        return {
          success: false,
          gameFamilyId: null,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: "Title is required",
            field: "title",
          },
        };
      }

      // Generate or validate slug
      let slug = inputSlug?.trim() || generateSlug(trimmedTitle);
      if (inputSlug) {
        const existingSlug = await ctx.prisma.gameFamily.findUnique({
          where: { slug },
        });
        if (existingSlug) {
          return {
            success: false,
            gameFamilyId: null,
            error: {
              code: ErrorCode.ALREADY_EXISTS,
              message: `A game family with slug "${slug}" already exists`,
              field: "slug",
            },
          };
        }
      } else {
        // Auto-generate unique slug
        let counter = 1;
        const baseSlug = slug;
        while (await ctx.prisma.gameFamily.findUnique({ where: { slug } })) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }
      }

      const gameType = type ?? GameType.BASE_GAME;

      // Validate baseGameFamilyIds if provided
      if (baseGameFamilyIds && baseGameFamilyIds.length > 0) {
        const baseFamilies = await ctx.prisma.gameFamily.findMany({
          where: { id: { in: baseGameFamilyIds } },
          select: { id: true },
        });

        const foundIds = new Set(baseFamilies.map(f => f.id));
        const missingIds = baseGameFamilyIds.filter(id => !foundIds.has(id));

        if (missingIds.length > 0) {
          return {
            success: false,
            gameFamilyId: null,
            error: {
              code: ErrorCode.NOT_FOUND,
              message: `Base game family(ies) not found: ${missingIds.join(", ")}`,
              field: "baseGameFamilyIds",
            },
          };
        }
      }

      // Create the GameFamily
      const gameFamily = await ctx.prisma.gameFamily.create({
        data: {
          title: trimmedTitle,
          slug,
          description: description?.trim() || null,
          coverUrl: coverUrl?.trim() || null,
          releaseDate: releaseDate ?? null,
          developer: developer?.trim() || null,
          publisher: publisher?.trim() || null,
          genre: genre?.trim() || null,
          esrbRating: esrbRating?.trim() || null,
          screenshots: screenshots ?? [],
          type: gameType,
          baseGameFamilies: baseGameFamilyIds && baseGameFamilyIds.length > 0
            ? { connect: baseGameFamilyIds.map(id => ({ id })) }
            : undefined,
        },
      });

      // Create platform games if specified
      if (platformIds && platformIds.length > 0) {
        let standardVersion = await ctx.prisma.gameVersion.findFirst({
          where: { slug: "standard" },
        });

        if (!standardVersion) {
          standardVersion = await ctx.prisma.gameVersion.create({
            data: {
              name: "Standard",
              slug: "standard",
              isDefault: true,
            },
          });
        }

        for (const platformId of platformIds) {
          const game = await ctx.prisma.game.create({
            data: {
              gameFamilyId: gameFamily.id,
              platformId,
              releaseDate: releaseDate ?? null,
            },
          });

          await ctx.prisma.$executeRaw`
            INSERT INTO "_GameVersionGames" ("A", "B")
            VALUES (${game.id}, ${standardVersion.id})
            ON CONFLICT DO NOTHING
          `;
        }
      }

      // Invalidate game caches after successful creation
      invalidateGameCaches().catch(() => {});

      return {
        success: true,
        gameFamilyId: gameFamily.id,
        error: null,
      };
    },
  })
);

// Update game family mutation
builder.mutationField("updateGameFamily", (t) =>
  t.field({
    type: GameFamilyMutationResult,
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: UpdateGameFamilyInput, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          gameFamilyId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to update a game family",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          gameFamilyId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to update game families",
            field: null,
          },
        };
      }

      const { id, input } = args;

      // Check if game family exists
      const existing = await ctx.prisma.gameFamily.findUnique({
        where: { id },
      });

      if (!existing) {
        return {
          success: false,
          gameFamilyId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Game family with id "${id}" not found`,
            field: null,
          },
        };
      }

      // Build update data
      const updateData: {
        title?: string;
        slug?: string;
        description?: string | null;
        coverUrl?: string | null;
        releaseDate?: Date | null;
        developer?: string | null;
        publisher?: string | null;
        genre?: string | null;
        esrbRating?: string | null;
        screenshots?: string[];
        type?: GameType;
        baseGameFamilies?: { set: { id: string }[] };
      } = {};

      if (input.title !== undefined && input.title !== null) {
        const trimmedTitle = input.title.trim();
        if (!trimmedTitle) {
          return {
            success: false,
            gameFamilyId: null,
            error: {
              code: ErrorCode.VALIDATION_ERROR,
              message: "Title cannot be empty",
              field: "title",
            },
          };
        }
        updateData.title = trimmedTitle;
      }

      if (input.slug !== undefined && input.slug !== null) {
        const trimmedSlug = input.slug.trim();
        if (trimmedSlug !== existing.slug) {
          const duplicate = await ctx.prisma.gameFamily.findUnique({
            where: { slug: trimmedSlug },
          });
          if (duplicate) {
            return {
              success: false,
              gameFamilyId: null,
              error: {
                code: ErrorCode.ALREADY_EXISTS,
                message: `A game family with slug "${trimmedSlug}" already exists`,
                field: "slug",
              },
            };
          }
          updateData.slug = trimmedSlug;
        }
      }

      if (input.description !== undefined) {
        updateData.description = input.description?.trim() || null;
      }

      if (input.coverUrl !== undefined) {
        updateData.coverUrl = input.coverUrl?.trim() || null;
      }

      if (input.releaseDate !== undefined) {
        updateData.releaseDate = input.releaseDate ?? null;
      }

      if (input.developer !== undefined) {
        updateData.developer = input.developer?.trim() || null;
      }

      if (input.publisher !== undefined) {
        updateData.publisher = input.publisher?.trim() || null;
      }

      if (input.genre !== undefined) {
        updateData.genre = input.genre?.trim() || null;
      }

      if (input.esrbRating !== undefined) {
        updateData.esrbRating = input.esrbRating?.trim() || null;
      }

      if (input.screenshots !== undefined) {
        updateData.screenshots = input.screenshots ?? [];
      }

      if (input.type !== undefined && input.type !== null) {
        updateData.type = input.type;
      }

      if (input.baseGameFamilyIds !== undefined) {
        if (input.baseGameFamilyIds !== null && input.baseGameFamilyIds.length > 0) {
          // Prevent self-reference
          if (input.baseGameFamilyIds.includes(id)) {
            return {
              success: false,
              gameFamilyId: null,
              error: {
                code: ErrorCode.VALIDATION_ERROR,
                message: "A game family cannot be its own base",
                field: "baseGameFamilyIds",
              },
            };
          }

          const baseFamilies = await ctx.prisma.gameFamily.findMany({
            where: { id: { in: input.baseGameFamilyIds } },
            select: { id: true },
          });

          const foundIds = new Set(baseFamilies.map(f => f.id));
          const missingIds = input.baseGameFamilyIds.filter(fId => !foundIds.has(fId));

          if (missingIds.length > 0) {
            return {
              success: false,
              gameFamilyId: null,
              error: {
                code: ErrorCode.NOT_FOUND,
                message: `Base game family(ies) not found: ${missingIds.join(", ")}`,
                field: "baseGameFamilyIds",
              },
            };
          }
        }
        updateData.baseGameFamilies = {
          set: (input.baseGameFamilyIds ?? []).map(fId => ({ id: fId })),
        };
      }

      // Update game family
      const gameFamily = await ctx.prisma.gameFamily.update({
        where: { id },
        data: updateData,
      });

      // Invalidate game caches after successful update
      invalidateGameCaches().catch(() => {});

      return {
        success: true,
        gameFamilyId: gameFamily.id,
        error: null,
      };
    },
  })
);

// Delete game family mutation
builder.mutationField("deleteGameFamily", (t) =>
  t.field({
    type: DeleteGameFamilyResult,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          deletedId: null,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to delete a game family",
            field: null,
          },
        };
      }

      if (!hasRequiredRole(ctx.user, UserRole.TRUSTED)) {
        return {
          success: false,
          deletedId: null,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: "You do not have permission to delete game families",
            field: null,
          },
        };
      }

      const { id } = args;

      // Check if game family exists
      const existing = await ctx.prisma.gameFamily.findUnique({
        where: { id },
      });

      if (!existing) {
        return {
          success: false,
          deletedId: null,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: `Game family with id "${id}" not found`,
            field: null,
          },
        };
      }

      // Delete game family (cascade will delete related games, achievement sets, etc.)
      await ctx.prisma.gameFamily.delete({
        where: { id },
      });

      // Invalidate game caches after successful deletion
      invalidateGameCaches().catch(() => {});

      return {
        success: true,
        deletedId: id,
        error: null,
      };
    },
  })
);
