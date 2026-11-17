/**
 * Check that deleteMyAccount leaves no user row behind, even when a request
 * with the user's still-valid token races the deletion or arrives while
 * Supabase can't be reached.
 *
 * Runs the real createContext and mutation. fetch is stubbed to play
 * Supabase: it serves a test signing key for tokens and answers the admin
 * lookup and delete calls. A racing request is fired from inside the delete
 * call, after the first pass removed the row but before the identity is gone.
 *
 * Needs a disposable database on localhost (see verify-trophy-progress.ts
 * for a recipe):
 *
 *   npx tsx scripts/verify-account-deletion.ts
 *
 * Exits non-zero if any check fails. Fixtures are deleted afterwards, so it
 * can be rerun against the same database.
 */

import assert from "node:assert/strict";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { AchievementSetType } from "@prisma/client";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !LOCAL_HOSTS.has(new URL(databaseUrl).hostname)) {
  console.error(
    "Set DATABASE_URL to a disposable database on localhost. This script creates and deletes users."
  );
  process.exit(1);
}

const SUPABASE_URL = "https://verify.supabase.invalid";
process.env.NODE_ENV = "production";
process.env.SUPABASE_URL = SUPABASE_URL;
process.env.SUPABASE_SECRET_KEY = "test-secret";

const SUPABASE_ID = "00000000-0000-4000-8000-00000000d1e7";
const EMAIL = "verify-account-deletion@example.invalid";

// Fake Supabase: the identities that exist, a hook run when one is deleted
// (before it's gone), and whether its admin API is down.
const identities = new Set([SUPABASE_ID]);
let beforeIdentityDeleted: () => Promise<void> = async () => {};
let adminApiDown = false;

const { publicKey, privateKey } = await generateKeyPair("ES256");
const jwks = { keys: [{ ...(await exportJWK(publicKey)), kid: "test", alg: "ES256" }] };

globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input);
  if (url.pathname.endsWith("/.well-known/jwks.json")) return Response.json(jwks);

  const id = url.pathname.match(/\/auth\/v1\/admin\/users\/(.+)$/)?.[1];
  if (!id) throw new Error(`Unexpected fetch: ${url}`);
  if (adminApiDown) throw new TypeError("fetch failed");
  if (init?.method === "DELETE") {
    await beforeIdentityDeleted();
    identities.delete(id);
    return new Response(null, { status: 200 });
  }
  return new Response(null, { status: identities.has(id) ? 200 : 404 });
};

const { graphql } = await import("graphql");
const { schema } = await import("../src/schema/index.js");
const { prisma } = await import("../src/lib/prisma.js");
const { createContext } = await import("../src/context.js");

const token = await new SignJWT({ email: EMAIL })
  .setProtectedHeader({ alg: "ES256", kid: "test" })
  .setSubject(SUPABASE_ID)
  .setIssuer(`${SUPABASE_URL}/auth/v1`)
  .setExpirationTime("1h")
  .sign(privateKey);

const authenticatedRequest = () =>
  createContext(
    new Request("http://localhost/graphql", { headers: { authorization: `Bearer ${token}` } })
  );
const userRows = () => prisma.user.count({ where: { supabaseId: SUPABASE_ID } });

async function cleanUp() {
  await prisma.achievementSet.deleteMany({ where: { title: { startsWith: "verify-account-deletion" } } });
  await prisma.user.deleteMany({ where: { supabaseId: SUPABASE_ID } });
}

try {
  await cleanUp();

  // A first sign-in while Supabase can't confirm the identity creates nothing.
  adminApiDown = true;
  assert.equal((await authenticatedRequest()).user, null, "an unconfirmed sign-in is signed out");
  assert.equal(await userRows(), 0, "an unconfirmed sign-in leaves no row behind");
  adminApiDown = false;

  // First sign-in creates the row.
  const ctx = await authenticatedRequest();
  assert.ok(ctx.user, "first sign-in creates the user");

  const customSet = await prisma.achievementSet.create({
    data: { title: "verify-account-deletion custom", type: AchievementSetType.CUSTOM, createdByUserId: ctx.user.id },
  });
  const catalogSet = await prisma.achievementSet.create({
    data: { title: "verify-account-deletion catalog", type: AchievementSetType.OFFICIAL, createdByUserId: ctx.user.id },
  });

  // A request lands after the first pass removed the row but before the
  // identity is gone, so it recreates the row.
  let racedRows = -1;
  beforeIdentityDeleted = async () => {
    await authenticatedRequest();
    racedRows = await userRows();
  };

  const result = await graphql({
    schema,
    source: "mutation { deleteMyAccount { success error { message } } }",
    contextValue: ctx,
  });
  assert.deepEqual(result.errors, undefined);
  assert.equal(
    (result.data as { deleteMyAccount: { success: boolean } }).deleteMyAccount.success,
    true,
    "the mutation succeeds"
  );
  assert.equal(racedRows, 1, "the racing request recreated the row (the race really happened)");
  assert.equal(await userRows(), 0, "the second pass removes the recreated row");
  assert.equal(identities.has(SUPABASE_ID), false, "the identity is deleted");
  assert.equal(
    await prisma.achievementSet.count({ where: { id: customSet.id } }),
    0,
    "the user's custom set is deleted"
  );
  assert.equal(
    (await prisma.achievementSet.findUnique({ where: { id: catalogSet.id } }))?.createdByUserId,
    null,
    "a catalog set the user created stays, without its creator"
  );

  // The token is still valid after the deletion.
  const afterwards = await authenticatedRequest();
  assert.equal(afterwards.user, null, "a later request is treated as signed out");
  assert.equal(await userRows(), 0, "a later request leaves no row behind");

  // The same holds while Supabase can't be reached to confirm it's gone.
  adminApiDown = true;
  assert.equal((await authenticatedRequest()).user, null, "a request during an outage is signed out");
  assert.equal(await userRows(), 0, "a request during an outage leaves no row behind");

  console.log("verify-account-deletion: all checks passed");
} finally {
  await cleanUp();
  await prisma.$disconnect();
}
