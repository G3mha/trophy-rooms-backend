import { builder, MutationErrorRef } from "../builder.js";
import { AchievementSetType, AchievementSetVisibility } from "@prisma/client";
import { ErrorCode } from "../../lib/errors.js";

// Register the enum
builder.enumType(AchievementSetType, {
  name: "AchievementSetType",
});

builder.enumType(AchievementSetVisibility, {
  name: "AchievementSetVisibility",
});

builder.prismaObject("AchievementSet", {
  fields: (t) => ({
    id: t.exposeID("id"),
    title: t.exposeString("title"),
    type: t.expose("type", { type: AchievementSetType }),
    visibility: t.expose("visibility", { type: AchievementSetVisibility }),

    // Link to GameFamily (achievements are shared across platforms)
    gameFamily: t.relation("gameFamily", { nullable: true }),
    gameFamilyId: t.exposeString("gameFamilyId", { nullable: true }),

    gameVersion: t.relation("gameVersion", { nullable: true }),
    gameVersionId: t.exposeString("gameVersionId", { nullable: true }),
    dlc: t.relation("dlc", { nullable: true }),
    dlcId: t.exposeString("dlcId", { nullable: true }),
    createdBy: t.relation("createdBy", { nullable: true }),
    createdByUserId: t.exposeString("createdByUserId", { nullable: true }),
    achievements: t.relation("achievements", {
      query: {
        orderBy: { title: "asc" },
      },
    }),
    achievementCount: t.relationCount("achievements"),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

export const CreateAchievementSetInput = builder.inputType(
  "CreateAchievementSetInput",
  {
    fields: (t) => ({
      title: t.string({ required: true }),
      type: t.field({ type: AchievementSetType, required: true }),
      gameFamilyId: t.id({ required: true }),
      gameVersionId: t.id(),
      dlcId: t.id(),
    }),
  }
);

export const UpdateAchievementSetInput = builder.inputType(
  "UpdateAchievementSetInput",
  {
    fields: (t) => ({
      title: t.string(),
      visibility: t.field({ type: AchievementSetVisibility }),
    }),
  }
);

// Mutation Result
export const AchievementSetMutationResult = builder.objectRef<{
  success: boolean;
  achievementSetId: string | null;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("AchievementSetMutationResult");

AchievementSetMutationResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    achievementSet: t.prismaField({
      type: "AchievementSet",
      nullable: true,
      resolve: async (query, result, _args, ctx) => {
        if (!result.achievementSetId) return null;
        return ctx.prisma.achievementSet.findUnique({
          ...query,
          where: { id: result.achievementSetId },
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
