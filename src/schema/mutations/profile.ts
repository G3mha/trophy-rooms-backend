import type { SocialNetwork } from "@prisma/client";
import { builder, MutationErrorRef } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";
import { pruneAvatars } from "../../lib/supabase.js";
import {
  BIO_MAX_LENGTH,
  NAME_MAX_LENGTH,
  SHOWCASE_MAX_GAMES,
  isOwnAvatarPath,
  normalizeHandle,
  showcaseEligibleWhere,
} from "../../lib/profile.js";
import { ShowcaseListEnum, SocialNetworkEnum } from "../types/profile.js";

type MutationError = { code: ErrorCode; message: string; field: string | null };

const ProfileMutationResult = builder.objectRef<{
  success: boolean;
  userId: string | null;
  error: MutationError | null;
}>("ProfileMutationResult");

ProfileMutationResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    user: t.prismaField({
      type: "User",
      nullable: true,
      resolve: (query, result, _args, ctx) =>
        result.userId
          ? ctx.prisma.user.findUnique({ ...query, where: { id: result.userId } })
          : null,
    }),
    error: t.field({
      type: MutationErrorRef,
      nullable: true,
      resolve: (result) => result.error,
    }),
  }),
});

const fail = (code: ErrorCode, message: string, field: string | null = null) => ({
  success: false,
  userId: null,
  error: { code, message, field },
});

const unauthorized = () =>
  fail(ErrorCode.UNAUTHORIZED, "You must be logged in to edit your profile");

const SocialLinkInput = builder.inputType("SocialLinkInput", {
  fields: (t) => ({
    network: t.field({ type: SocialNetworkEnum, required: true }),
    handle: t.string({ required: true }),
  }),
});

// Every field is optional: one left out stays as it is. Null clears name,
// bio and avatar; socialLinks replaces the whole set.
const UpdateMyProfileInput = builder.inputType("UpdateMyProfileInput", {
  fields: (t) => ({
    name: t.string(),
    bio: t.string(),
    // Key of a file the client uploaded to the avatars bucket, under its
    // own "<supabaseId>/" folder
    avatarPath: t.string(),
    socialLinks: t.field({ type: [SocialLinkInput] }),
  }),
});

builder.mutationField("updateMyProfile", (t) =>
  t.field({
    type: ProfileMutationResult,
    args: { input: t.arg({ type: UpdateMyProfileInput, required: true }) },
    resolve: async (_root, { input }, ctx) => {
      if (!ctx.user) return unauthorized();
      const { id: userId, supabaseId } = ctx.user;

      const data: { name?: string | null; bio?: string | null; avatarPath?: string | null } = {};

      if (input.name !== undefined) {
        const name = input.name?.trim() || null;
        if (name && name.length > NAME_MAX_LENGTH) {
          return fail(ErrorCode.VALIDATION_ERROR, `Name can be at most ${NAME_MAX_LENGTH} characters`, "name");
        }
        data.name = name;
      }

      if (input.bio !== undefined) {
        const bio = input.bio?.trim() || null;
        if (bio && bio.length > BIO_MAX_LENGTH) {
          return fail(ErrorCode.VALIDATION_ERROR, `Bio can be at most ${BIO_MAX_LENGTH} characters`, "bio");
        }
        data.bio = bio;
      }

      if (input.avatarPath !== undefined) {
        if (input.avatarPath !== null && !isOwnAvatarPath(input.avatarPath, supabaseId)) {
          return fail(ErrorCode.VALIDATION_ERROR, "That picture isn't one you uploaded", "avatarPath");
        }
        // Old files go before the reference changes, so a failed delete
        // leaves the profile as it was instead of orphaning a file
        if (!(await pruneAvatars(supabaseId, input.avatarPath))) {
          return fail(ErrorCode.INTERNAL_ERROR, "Couldn't update your picture. Please try again.", "avatarPath");
        }
        data.avatarPath = input.avatarPath;
      }

      let links: { network: SocialNetwork; handle: string }[] | null = null;
      if (input.socialLinks) {
        links = [];
        for (const link of input.socialLinks) {
          if (!link.handle.trim()) continue;
          const handle = normalizeHandle(link.handle);
          if (!handle) {
            return fail(ErrorCode.VALIDATION_ERROR, `That ${link.network} handle isn't valid`, "socialLinks");
          }
          if (links.some((existing) => existing.network === link.network)) {
            return fail(ErrorCode.VALIDATION_ERROR, `Add ${link.network} only once`, "socialLinks");
          }
          links.push({ network: link.network, handle });
        }
      }

      await ctx.prisma.$transaction([
        ctx.prisma.user.update({ where: { id: userId }, data }),
        ...(links
          ? [
              ctx.prisma.userSocialLink.deleteMany({ where: { userId } }),
              ctx.prisma.userSocialLink.createMany({
                data: links.map((link) => ({ ...link, userId })),
              }),
            ]
          : []),
      ]);

      return { success: true, userId, error: null };
    },
  })
);

// Replaces one profile list with these games, in this order
builder.mutationField("setProfileShowcase", (t) =>
  t.field({
    type: ProfileMutationResult,
    args: {
      list: t.arg({ type: ShowcaseListEnum, required: true }),
      gameFamilyIds: t.arg.idList({ required: true }),
    },
    resolve: async (_root, { list, gameFamilyIds }, ctx) => {
      if (!ctx.user) return unauthorized();
      const userId = ctx.user.id;
      const ids = gameFamilyIds.map(String);

      if (ids.length > SHOWCASE_MAX_GAMES) {
        return fail(ErrorCode.VALIDATION_ERROR, `Pick at most ${SHOWCASE_MAX_GAMES} games`, "gameFamilyIds");
      }
      if (new Set(ids).size !== ids.length) {
        return fail(ErrorCode.VALIDATION_ERROR, "Each game can appear once", "gameFamilyIds");
      }

      const eligible = await ctx.prisma.gameFamily.count({
        where: { id: { in: ids }, ...showcaseEligibleWhere(list, userId) },
      });
      if (eligible !== ids.length) {
        return fail(ErrorCode.VALIDATION_ERROR, "Some of those games can't go in this list", "gameFamilyIds");
      }

      await ctx.prisma.$transaction([
        ctx.prisma.profileShowcaseEntry.deleteMany({ where: { userId, list } }),
        ctx.prisma.profileShowcaseEntry.createMany({
          data: ids.map((gameFamilyId, position) => ({ userId, list, gameFamilyId, position })),
        }),
      ]);

      return { success: true, userId, error: null };
    },
  })
);
