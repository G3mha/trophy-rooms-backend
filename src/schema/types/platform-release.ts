import { builder, MutationErrorRef } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";

builder.prismaObject("PlatformRelease", {
  fields: (t) => ({
    id: t.exposeID("id"),
    region: t.exposeString("region"),
    releaseDate: t.expose("releaseDate", { type: "DateTime" }),
    platform: t.relation("platform"),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

// Input types for mutations
export const CreatePlatformReleaseInput = builder.inputType(
  "CreatePlatformReleaseInput",
  {
    fields: (t) => ({
      platformId: t.string({ required: true }),
      region: t.string({ required: true }),
      releaseDate: t.field({ type: "DateTime", required: true }),
    }),
  }
);

export const UpdatePlatformReleaseInput = builder.inputType(
  "UpdatePlatformReleaseInput",
  {
    fields: (t) => ({
      region: t.string(),
      releaseDate: t.field({ type: "DateTime" }),
    }),
  }
);

// Mutation Result
export const PlatformReleaseMutationResult = builder.objectRef<{
  success: boolean;
  release: { id: string } | null;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("PlatformReleaseMutationResult");

PlatformReleaseMutationResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    release: t.prismaField({
      type: "PlatformRelease",
      nullable: true,
      resolve: async (query, result, _args, ctx) => {
        if (!result.release) return null;
        return ctx.prisma.platformRelease.findUnique({
          ...query,
          where: { id: result.release.id },
        });
      },
    }),
    error: t.field({
      type: MutationErrorRef,
      nullable: true,
      resolve: (result) => result.error,
    }),
  }),
});
