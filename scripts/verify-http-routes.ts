/**
 * Check what the HTTP server answers on paths that are not the GraphQL
 * endpoint, through the real Yoga handler from src/server.ts.
 *
 * Yoga's `landingPage` option, left at its default, serves a welcome page
 * with status 200 for ANY unmatched path when the request is a GET whose
 * Accept header includes text/html. curl sends `Accept: * / *` and gets the
 * 404, so the gap only shows up with a browser-like header - which is what a
 * vulnerability scanner sends. These checks pin the 404 down for both.
 *
 * Needs no database: the unhandled-route check runs before the schema or
 * Prisma is touched, and the one GraphQL call asks for __typename.
 *
 *   npx tsx scripts/verify-http-routes.ts
 *
 * Exits non-zero if any check fails.
 */

import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

// Match the deployed container: production logging (no pino-pretty worker,
// so the process can exit) and the introspection rule in place.
process.env.NODE_ENV = "production";

// Constructing PrismaClient needs a syntactically valid URL, and supabase.ts
// resolves SUPABASE_URL at import. Nothing here connects to either.
process.env.DATABASE_URL ??= "postgresql://postgres@127.0.0.1:5499/unused";
process.env.DIRECT_URL ??= process.env.DATABASE_URL;
process.env.SUPABASE_URL ??= "http://127.0.0.1.invalid";

const { yoga } = await import("../src/server.js");

const BROWSER_ACCEPT =
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";

const failures: string[] = [];
let passed = 0;

function check(name: string, actual: unknown, expected: unknown) {
  try {
    assert.deepStrictEqual(actual, expected);
    passed++;
    console.log(`  PASS ${name}`);
  } catch {
    failures.push(name);
    console.log(`  FAIL ${name}`);
    console.log(`       expected ${JSON.stringify(expected)}`);
    console.log(`       actual   ${JSON.stringify(actual)}`);
  }
}

const server = createServer((req, res) => {
  yoga(req, res);
});

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address() as AddressInfo;
const base = `http://127.0.0.1:${port}`;

async function get(path: string, accept: string) {
  const response = await fetch(`${base}${path}`, { headers: { accept } });
  return { status: response.status, body: await response.text() };
}

try {
  // The paths the scanner swept, plus the root and a path nothing could claim.
  const unknownPaths = [
    "/",
    "/admin",
    "/profile",
    "/billing",
    "/cadastro",
    "/graphql-playground",
    "/not-a-route-7f3c",
  ];

  console.log("Unknown paths, browser Accept header:");
  for (const path of unknownPaths) {
    const { status, body } = await get(path, BROWSER_ACCEPT);
    check(`GET ${path} is 404`, status, 404);
    check(`GET ${path} serves no landing page`, body.includes("GraphQL Yoga"), false);
  }

  console.log("Unknown paths, non-browser Accept header:");
  for (const path of unknownPaths) {
    const { status } = await get(path, "*/*");
    check(`GET ${path} is 404`, status, 404);
  }

  console.log("Real routes still answer:");
  const health = await get("/health", BROWSER_ACCEPT);
  check("GET /health is 200", health.status, 200);

  const graphql = await get("/graphql?query=%7B__typename%7D", BROWSER_ACCEPT);
  check("GET /graphql is 200", graphql.status, 200);
  check(
    "GET /graphql resolves __typename",
    JSON.parse(graphql.body),
    { data: { __typename: "Query" } }
  );
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  for (const name of failures) console.log(`  - ${name}`);
  process.exit(1);
}
