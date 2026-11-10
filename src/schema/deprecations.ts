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
 * To remove the shim: delete this constant, then delete the five `userEmail`
 * fields that reference USER_EMAIL_DEPRECATION. Safe to do once the iOS
 * release that stopped selecting `userEmail` has saturated the install base.
 */
export const USER_EMAIL_DEPRECATION =
  "Emails are no longer exposed publicly. Use userName and userId instead. " +
  "This field always returns an empty string and will be removed.";

/**
 * Points were removed from the web and iOS apps, but shipped iOS builds still
 * select these fields and decode most of them as non-optional. Unlike the
 * email shim above, these keep returning real values, because those builds
 * still display them.
 *
 * To remove the shim: delete every field that references POINTS_DEPRECATION
 * and the point totals in their resolvers, then drop `Achievement.points` with
 * a migration. Safe to do once the iOS release that stopped selecting points
 * has saturated the install base.
 */
export const POINTS_DEPRECATION =
  "Points were removed from Trophy Rooms. This field will be removed.";
