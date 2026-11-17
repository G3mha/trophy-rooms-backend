/**
 * Check that supabaseUserExists only reports a user as gone when Supabase
 * answers 404. createContext skips recreating the account row on that answer,
 * so a token used after deleteMyAccount can't bring the email back, while an
 * outage or a missing key still lets first sign-ins through.
 *
 * Stubs fetch, so it needs no network, database or real keys.
 *
 *   npx tsx scripts/verify-deleted-identity.ts
 *
 * Exits non-zero if any check fails.
 */

import assert from "node:assert/strict";

// supabase.ts resolves SUPABASE_URL at import. Nothing here connects to it.
process.env.NODE_ENV = "production";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY = "test-secret";

const { supabaseUserExists } = await import("../src/lib/supabase.js");

function stubFetch(answer: number | Error) {
  globalThis.fetch = async () => {
    if (answer instanceof Error) throw answer;
    return new Response(null, { status: answer });
  };
}

stubFetch(200);
assert.equal(await supabaseUserExists("id"), true, "200 means the user exists");

stubFetch(404);
assert.equal(await supabaseUserExists("id"), false, "404 means the user is gone");

stubFetch(500);
assert.equal(await supabaseUserExists("id"), null, "a server error is unknown");

stubFetch(new Error("offline"));
assert.equal(await supabaseUserExists("id"), null, "a network error is unknown");

delete process.env.SUPABASE_SECRET_KEY;
stubFetch(404);
assert.equal(await supabaseUserExists("id"), null, "no key means unknown");

console.log("verify-deleted-identity: all checks passed");
