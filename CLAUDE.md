# Trophy Rooms Backend - Development Guidelines

GraphQL API for Trophy Rooms (Node.js, Prisma, Pothos).

## Required Workflow

**IMPORTANT: Always follow this workflow after making code changes.**

### 1. Lint and Build

```bash
npm run lint
npm run build
```

Fix any lint errors or build failures before proceeding.

### 2. Commit Strategy

Always maximize the number of commits using stacked diffs style:

- Make small, atomic commits - one logical change per commit
- Each commit should be independently meaningful, reviewable, and testable
- Break large features into multiple smaller commits (e.g., scaffolding, core logic, tests)
- Use clear, concise commit messages following conventional commits:
  - `feat:` - new features
  - `fix:` - bug fixes
  - `refactor:` - code restructuring
  - `chore:` - maintenance tasks
  - `docs:` - documentation
- Never combine unrelated changes into a single commit

### 3. Push

```bash
git push origin main
```

## Data Scripts

One-off database scripts live in `scripts/` and run with `npx tsx scripts/<name>.ts`. Conventions:

- `check-*.ts` - read-only inspection of current data
- `import-*.ts` - add new games/bundles (idempotent: skip records that already exist)
- `fix-*.ts` - correct existing data (verify no user data is attached before deleting anything)

Game metadata (covers, descriptions, release dates) comes from IGDB via `src/lib/igdb.ts`.

## Game Data Model Rules

### GameFamily vs Game

- **GameFamily**: Canonical game metadata (title, description, cover). One per game regardless of platforms.
- **Game**: Platform-specific instance. Links a GameFamily to a Platform with optional version and cover override.

### Nintendo Switch 2 Enhanced Editions

When a game has both Switch 1 and Switch 2 versions:

1. **Same GameFamily**: Both versions belong to the SAME GameFamily (not separate entries)
2. **GameFamily cover**: Always use the ORIGINAL game's cover (Switch 1), never the Switch 2 edition cover
3. **Explicit covers on BOTH platforms**: Each Game entry should have its own explicit `coverUrl`:
   - Switch 1 Game: Set `coverUrl` to the original game cover (same as GameFamily)
   - Switch 2 Game: Set `coverUrl` to the Switch 2 edition specific cover
4. **Version naming**: Create a GameVersion with the official name (e.g., "Nintendo Switch 2 Edition + Star-Crossed World")
5. **DLC inclusion**: If the Switch 2 version includes DLC, reflect this in the version name

### Example: Kirby and the Forgotten Land

```
GameFamily: "Kirby and the Forgotten Land"
  coverUrl: [original Switch cover]

Game entries:
  - Platform: Nintendo Switch
    Version: Standard
    coverUrl: [original Switch cover] (explicit, same as GameFamily)

  - Platform: Nintendo Switch 2
    Version: "Nintendo Switch 2 Edition + Star-Crossed World"
    coverUrl: [Switch 2 edition specific cover]
```

### Compilations / Multi-Game Re-releases

When multiple complete games are sold as one retail product (e.g., "Super Mario 3D World + Bowser's Fury", "Super Mario 3D All-Stars"):

1. **No new GameFamily for the compilation**: Each included game keeps its own GameFamily
2. **Create a Game entry per included family on the compilation's platform**: This is what makes trophies, the library, and platform filtering work for each game
3. **Compilation-only covers**: If a game is only sold via the compilation on that platform, set the Game's explicit `coverUrl` to the compilation box art. The GameFamily cover stays the original release's art
4. **The compilation itself is a Bundle** with `type: COLLECTION`, connected to the included GameFamilies and the platform, with the retail box art and release date
5. **Ownership goes through the Bundle**: The physical cart/box in a collection is a UserBundle. Games only available inside the compilation should NOT get standalone GameVersions users can add to collections directly
   - Adding a bundle to owned can also add the included games to the user's library (`addBundleToOwned.libraryGameFamilyIds`): each selected family's Game on the bundle's platform is upserted as a BACKLOG UserGame, never overwriting existing entries. Removing the bundle never removes UserGames - play history outlives ownership
6. **BUNDLE vs COLLECTION**: `BUNDLE` = a game packaged with its DLC (e.g., "Elden Ring + Shadow of the Erdtree"); `COLLECTION` = multiple complete games

### Example: Super Mario 3D World + Bowser's Fury

```
GameFamily: "Super Mario 3D World"
  coverUrl: [original Wii U cover]
  Game entries:
    - Platform: Wii U (standalone release)
    - Platform: Nintendo Switch
      coverUrl: [compilation box art] (only sold via the compilation)

GameFamily: "Bowser's Fury"
  Game entries:
    - Platform: Nintendo Switch

Bundle: "Super Mario 3D World + Bowser's Fury"
  type: COLLECTION
  platforms: [Nintendo Switch]
  gameFamilies: [Super Mario 3D World, Bowser's Fury]
  coverUrl: [compilation box art]
  releaseDate: 2021-02-12
```

### Nintendo Switch Online (NSO)

Do NOT add NSO as a platform or create entries for NSO releases. NSO does not offer ownership - it's a subscription service for playing classic games. Only track games that can be owned.

### Backward Compatibility

Do NOT create Game entries for platforms that merely play a game via backward compatibility (e.g., a Switch game playable on Switch 2, a PS4 game playable on PS5). A Game entry requires an actual platform release that can be owned. Only create the newer platform's entry when a distinct edition exists for it (see the Switch 2 Enhanced Editions rules).
