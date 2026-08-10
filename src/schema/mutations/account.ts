import { builder, MutationErrorRef } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";
import { deleteSupabaseUser } from "../../lib/supabase.js";

const DeleteMyAccountResult = builder.objectRef<{
  success: boolean;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("DeleteMyAccountResult");

DeleteMyAccountResult.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    error: t.field({
      type: MutationErrorRef,
      nullable: true,
      resolve: (result) => result.error,
    }),
  }),
});

// Permanently deletes the authenticated user's account: all app data via
// cascading deletes, then the Supabase identity. Required by App Store
// guideline 5.1.1(v) (in-app account deletion).
builder.mutationField("deleteMyAccount", (t) =>
  t.field({
    type: DeleteMyAccountResult,
    resolve: async (_root, _args, ctx) => {
      if (!ctx.user) {
        return {
          success: false,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: "You must be logged in to delete your account",
            field: null,
          },
        };
      }

      const { id, supabaseId } = ctx.user;

      // App data first (cascades wipe collection, library, journal, etc.);
      // if the identity deletion then fails, the next authenticated request
      // recreates an empty user row and the deletion can be retried.
      await ctx.prisma.user.delete({ where: { id } });

      const identityDeleted = await deleteSupabaseUser(supabaseId);
      if (!identityDeleted) {
        return {
          success: false,
          error: {
            code: ErrorCode.INTERNAL_ERROR,
            message: "Account data was removed but the sign-in identity could not be deleted. Please try again.",
            field: null,
          },
        };
      }

      return { success: true, error: null };
    },
  })
);
