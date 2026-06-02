/**
 * Normalize a string for search indexing.
 * - Converts to lowercase
 * - Removes accents/diacritics (é → e, ü → u, etc.)
 * - Removes all non-alphanumeric characters (spaces, punctuation)
 *
 * Examples:
 *   "Pokémon LeafGreen Version" → "pokemonleafgreenversion"
 *   "The Legend of Zelda: A Link to the Past" → "thelegendofzeldaalinktothepast"
 *   "Super Mario Bros. 3" → "supermariobros3"
 */
export function normalizeForSearch(text: string): string {
  return text
    // Normalize unicode to decomposed form (é becomes e + combining accent)
    .normalize("NFD")
    // Remove combining diacritical marks (accents)
    .replace(/[\u0300-\u036f]/g, "")
    // Convert to lowercase
    .toLowerCase()
    // Remove all non-alphanumeric characters
    .replace(/[^a-z0-9]/g, "");
}
