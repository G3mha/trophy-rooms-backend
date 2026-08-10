import { builder, MutationErrorRef } from "../builder.js";
import { ErrorCode } from "../../lib/errors.js";
import { deleteClerkUser } from "../../lib/clerk.js";

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
// cascading deletes, then the Clerk identity. Required by App Store
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

      const { id, clerkId } = ctx.user;

      // App data first (cascades wipe collection, library, journal, etc.);
      // if the Clerk deletion then fails, the next authenticated request
      // recreates an empty user row and the deletion can be retried.
      await ctx.prisma.user.delete({ where: { id } });

      const clerkDeleted = await deleteClerkUser(clerkId);
      if (!clerkDeleted) {
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
