// Checks the profile input rules in src/lib/profile.ts. No database needed:
// npx tsx scripts/verify-profile-validation.ts
import assert from "node:assert/strict";
import { SocialNetwork } from "@prisma/client";
import { isOwnAvatarPath, normalizeHandle, socialProfileUrl } from "../src/lib/profile.js";

const uid = "0b6f6c1e-2c4a-4a8e-9d55-3f1f2b9c7a10";

assert.equal(normalizeHandle("  @mario_64 "), "mario_64");
assert.equal(normalizeHandle("Major Nelson"), "Major Nelson"); // Xbox gamertags have spaces
assert.equal(normalizeHandle("SW-1234-5678-9012"), "SW-1234-5678-9012");
assert.equal(normalizeHandle("   "), null);
assert.equal(normalizeHandle("evil/../path"), null);
assert.equal(normalizeHandle("<script>"), null);
assert.equal(normalizeHandle("a".repeat(65)), null);

assert.equal(isOwnAvatarPath(`${uid}/3f1f2b9c.webp`, uid), true);
assert.equal(isOwnAvatarPath(`someone-else/3f1f2b9c.webp`, uid), false);
assert.equal(isOwnAvatarPath(`${uid}/../x/3f1f2b9c.webp`, uid), false);
assert.equal(isOwnAvatarPath(`${uid}/3f1f2b9c.svg`, uid), false);
assert.equal(isOwnAvatarPath(uid, uid), false);

assert.equal(socialProfileUrl(SocialNetwork.TWITCH, "mario_64"), "https://www.twitch.tv/mario_64");
assert.equal(socialProfileUrl(SocialNetwork.YOUTUBE, "Major Nelson"), "https://www.youtube.com/@Major%20Nelson");
assert.equal(socialProfileUrl(SocialNetwork.PSN, "mario_64"), null);

console.log("profile validation OK");
