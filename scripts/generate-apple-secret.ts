/**
 * Mints the Sign in with Apple OAuth client secret for the Supabase Apple
 * provider ("Secret Key (for OAuth)" field).
 *
 * Apple's client secret is a short-lived ES256 JWT signed with the SIWA
 * private key (max validity 6 months) - re-run this and update Supabase
 * before it expires.
 *
 * Usage: npx tsx scripts/generate-apple-secret.ts
 * Reads APPLE_SIWA_KEY_PATH, APPLE_SIWA_KEY_ID, APPLE_TEAM_ID, and
 * APPLE_SERVICE_ID from the environment (.env).
 */

import { readFileSync } from "node:fs";
import { SignJWT, importPKCS8 } from "jose";

try {
  process.loadEnvFile?.();
} catch {
  // Ignore missing env file in deployed environments.
}

async function main() {
  const keyPath = process.env.APPLE_SIWA_KEY_PATH;
  const keyId = process.env.APPLE_SIWA_KEY_ID;
  const teamId = process.env.APPLE_TEAM_ID;
  const serviceId = process.env.APPLE_SERVICE_ID;

  if (!keyPath || !keyId || !teamId || !serviceId) {
    console.error(
      "Missing env: APPLE_SIWA_KEY_PATH, APPLE_SIWA_KEY_ID, APPLE_TEAM_ID, APPLE_SERVICE_ID"
    );
    process.exit(1);
  }

  const pem = readFileSync(keyPath, "utf8");
  const privateKey = await importPKCS8(pem, "ES256");

  // 180 days keeps us safely under Apple's 6-month maximum
  const expiresAt = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);

  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .setAudience("https://appleid.apple.com")
    .setSubject(serviceId)
    .sign(privateKey);

  console.log("Apple OAuth client secret (paste into Supabase > Apple provider > Secret Key):\n");
  console.log(jwt);
  console.log(`\nExpires: ${expiresAt.toISOString().slice(0, 10)} - re-run this script and update Supabase before then.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
