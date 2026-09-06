/**
 * Compatibility shims kept only for already-installed clients.
 *
 * Shipped iOS builds still select `userEmail` on the public leaderboard and
 * activity types. Dropping the field outright is a GraphQL validation error,
 * and validation fails the whole query - those screens would not degrade,
 * they would stop loading entirely. So the field stays in the schema,
 * deprecated, and always resolves to a constant empty string. No resolver
 * selects the email column any more, so nothing is served either way.
 *
 * To remove the shim: delete this file, then delete the five `userEmail`
 * fields that reference USER_EMAIL_DEPRECATION. Safe to do once the iOS
 * release that stopped selecting `userEmail` has saturated the install base.
 */
export const USER_EMAIL_DEPRECATION =
  "Emails are no longer exposed publicly. Use userName and userId instead. " +
  "This field always returns an empty string and will be removed.";
