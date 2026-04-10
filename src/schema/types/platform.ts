import { builder, MutationErrorRef } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";

builder.prismaObject("Platform", {
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    slug: t.exposeString("slug"),
    games: t.relation("games", {
      query: {
        orderBy: { gameFamily: { title: "asc" } },
      },
    }),
    gameCount: t.relationCount("games"),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

// Basic input for creating a platform (for admin usage mostly)
export const CreatePlatformInput = builder.inputType("CreatePlatformInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    slug: t.string({ required: true }),
  }),
});

export const UpdatePlatformInput = builder.inputType("UpdatePlatformInput", {
  fields: (t) => ({
    name: t.string(),
    slug: t.string(),
  }),
});

// Mutation Result
export const PlatformMutationResult = builder.objectRef<{
  success: boolean;
  platform: { id: string } | null;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("PlatformMutationResult");

PlatformMutationResult.implement({
    fields: (t) => ({
        success: t.exposeBoolean("success"),
        platform: t.prismaField({
            type: "Platform",
            nullable: true,
            resolve: async (query, result, _args, ctx) => {
                if (!result.platform) return null;
                return ctx.prisma.platform.findUnique({
                    ...query,
                    where: { id: result.platform.id },
                });
            }
        }),
        error: t.field({
            type: MutationErrorRef,
            nullable: true,
            resolve: (result) => result.error,
        })
    })
});
