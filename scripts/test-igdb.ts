import { getIGDBToken, fetchGamesForPlatform, QUALITY_FILTERS } from "../src/lib/igdb.js";

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID!;

async function main() {
  console.log("Testing IGDB API...\n");

  // Quick test of fetchGamesForPlatform
  console.log("Testing fetchGamesForPlatform for Nintendo Switch (130)...");
  const games = await fetchGamesForPlatform([130], QUALITY_FILTERS.noFilter, 0, 5);
  console.log(`Got ${games.length} games:`, games.map(g => g.name));
  if (games.length > 0) {
    console.log("\nFirst game details:", games[0]);
    console.log("\n✅ fetchGamesForPlatform is working!\n");
    return;
  }
  console.log("\n❌ Still no games, continuing with detailed tests...\n");

  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
    console.error("Missing TWITCH credentials");
    process.exit(1);
  }

  console.log("Client ID:", TWITCH_CLIENT_ID.substring(0, 5) + "...");

  try {
    const token = await getIGDBToken();
    console.log("Token obtained:", token.substring(0, 10) + "...");

    // Test 1: Just fetch any games, no filter
    const query1 = `
      fields id, name;
      limit 5;
    `;

    console.log("\nTest 1: No filter");
    console.log(query1);

    const response1 = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body: query1,
    });

    console.log("Response status:", response1.status);
    const text1 = await response1.text();
    console.log("Games:", text1.substring(0, 300));

    // Test 2a: Platform filter only - syntax 1
    console.log("\n\nTest 2a: platforms = (130)");
    const query2a = `fields id, name, platforms.name; where platforms = (130); limit 5;`;
    const r2a = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: { "Client-ID": TWITCH_CLIENT_ID, Authorization: `Bearer ${token}`, "Content-Type": "text/plain" },
      body: query2a,
    });
    console.log("Status:", r2a.status, "Body:", (await r2a.text()).substring(0, 200));

    // Test 2b: Platform filter only - syntax 2
    console.log("\n\nTest 2b: platforms.id = 130");
    const query2b = `fields id, name, platforms.name; where platforms.id = 130; limit 5;`;
    const r2b = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: { "Client-ID": TWITCH_CLIENT_ID, Authorization: `Bearer ${token}`, "Content-Type": "text/plain" },
      body: query2b,
    });
    console.log("Status:", r2b.status, "Body:", (await r2b.text()).substring(0, 200));

    // Test 2c: Try with array contains syntax
    console.log("\n\nTest 2c: platforms = [130]");
    const query2c = `fields id, name, platforms.name; where platforms = [130]; limit 5;`;
    const r2c = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: { "Client-ID": TWITCH_CLIENT_ID, Authorization: `Bearer ${token}`, "Content-Type": "text/plain" },
      body: query2c,
    });
    console.log("Status:", r2c.status, "Body:", (await r2c.text()).substring(0, 200));

    // Test 2d: Get games with category field to see values
    console.log("\n\nTest 2d: Check category values on Nintendo Switch games");
    const query2d = `fields id, name, category; where platforms = (130); limit 10;`;
    const r2d = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: { "Client-ID": TWITCH_CLIENT_ID, Authorization: `Bearer ${token}`, "Content-Type": "text/plain" },
      body: query2d,
    });
    console.log("Status:", r2d.status, "Body:", (await r2d.text()).substring(0, 800));

    // Test 2e: Category filter with parentheses
    console.log("\n\nTest 2e: category = (0)");
    const query2e = `fields id, name, category; where category = (0); limit 5;`;
    const r2e = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: { "Client-ID": TWITCH_CLIENT_ID, Authorization: `Bearer ${token}`, "Content-Type": "text/plain" },
      body: query2e,
    });
    console.log("Status:", r2e.status, "Body:", (await r2e.text()).substring(0, 400));

    // Test 2f: Combined with platform and category with parentheses
    console.log("\n\nTest 2f: platforms = (130) & category = (0)");
    const query2f = `fields id, name, category; where platforms = (130) & category = (0); limit 5;`;
    const r2f = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: { "Client-ID": TWITCH_CLIENT_ID, Authorization: `Bearer ${token}`, "Content-Type": "text/plain" },
      body: query2f,
    });
    console.log("Status:", r2f.status, "Body:", (await r2f.text()).substring(0, 400));

    // Test 2: Nintendo Switch games with platforms filter
    const query = `
      fields id, name, platforms.name, category;
      where platforms = (130) & category = (0);
      limit 10;
    `;

    console.log("\nQuery:");
    console.log(query);

    const response = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body: query,
    });

    console.log("\nResponse status:", response.status);

    const text = await response.text();
    console.log("Response body:", text.substring(0, 500));

    if (response.ok) {
      const games = JSON.parse(text);
      console.log(`\nGames returned: ${games.length}`);
      if (games.length > 0) {
        console.log("First game:", games[0]);
      }
    }

    // Test 3: Query platforms endpoint
    console.log("\n\nTest 3: Platforms endpoint");
    const platformQuery = `
      fields id, name;
      where id = 130;
    `;

    const platformResponse = await fetch("https://api.igdb.com/v4/platforms", {
      method: "POST",
      headers: {
        "Client-ID": TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body: platformQuery,
    });

    console.log("Response status:", platformResponse.status);
    const platformText = await platformResponse.text();
    console.log("Platform 130:", platformText);

  } catch (error) {
    console.error("Error:", error);
  }
}

main();
