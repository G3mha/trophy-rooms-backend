import { igdbRequest, getCoverUrl, type IGDBGame } from "../src/lib/igdb.js";

async function main() {
  const results = await igdbRequest<IGDBGame[]>(
    "games",
    `fields id, name, slug, cover.image_id, first_release_date;
     where name ~ *"Sifu"*; limit 20;`
  );
  for (const g of results) {
    console.log(
      `- ${g.name} (${g.slug}) release=${g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().split("T")[0] : "n/a"} cover=${g.cover?.image_id ? getCoverUrl(g.cover.image_id, "cover_big") : "none"}`
    );
  }
}

main().catch(console.error);
