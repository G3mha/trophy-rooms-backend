# Trophy Rooms API

The shared GraphQL backend for [Trophy Rooms](https://trophyrooms.org), a game library, physical collection, play journal, and achievement tracker.

Built by Enricco Gemha with TypeScript, GraphQL Yoga, Pothos, Prisma, and PostgreSQL. Supabase provides authentication; Redis is an optional cache. The [iOS app](https://github.com/G3mha/trophy-rooms-ios) and [web app](https://github.com/G3mha/trophy-rooms-web) use this API.

## What it does

- Serves games, platforms, editions, DLC, and bundles.
- Stores libraries, physical collections, buy/sell lists, and play sessions.
- Tracks manually recorded achievements and trophy progress.
- Provides community activity, leaderboards, and role-controlled catalog administration.
- Supports catalog enrichment from IGDB and achievement import tools.

The catalog spans multiple platforms. Achievement lists cover part of it, and progress is recorded manually rather than synchronized from consoles or PC stores.

## Local setup

You need Node.js 20 or later, npm, an isolated PostgreSQL development database, and a Supabase development project using asymmetric JWT signing keys. Both clients must authenticate against that same Supabase project.

```bash
git clone https://github.com/G3mha/trophy-rooms-backend.git
cd trophy-rooms-backend
cp .env.example .env
```

Edit `.env` before continuing:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL query connection; Supabase transaction pooler URLs use `pgbouncer=true` |
| `DIRECT_URL` | Direct/session connection for Prisma schema operations |
| `SUPABASE_URL` | Required at startup; identifies the JWT issuer and public JWKS endpoint |
| `SUPABASE_SECRET_KEY` | Server-only service-role key, needed for account deletion in Supabase Auth |
| `NODE_ENV` | Set to `development` for local GraphiQL and introspection |
| `PORT` | API port; defaults to `4000` |
| `FRONTEND_URL` | Comma-separated allowed frontend origins; default `http://localhost:3000` |
| `REDIS_URL` | Optional cache connection; remove or leave unset without Redis |

`.env.example` also documents Twitch/IGDB credentials, RetroAchievements imports, Apple sign-in tooling, and logging options. Those integrations are not required to start an empty local API. Keep real credentials out of Git.

```bash
npm ci

# Export the edited local configuration into this shell.
set -a
. ./.env
set +a

# Initialize an EMPTY, DISPOSABLE development database.
npm run db:push

# Optional: create the platform catalog.
npm run db:seed-platforms

npm run dev
```

`db:push` is a local bootstrap path, not a production migration procedure. Review migration history and database state before changing an existing database. A new database has no games until records are added or imported.

## Endpoints and authentication

| Endpoint | Purpose |
|---|---|
| `http://localhost:4000/graphql` | GraphQL HTTP endpoint; GraphiQL in development |
| `http://localhost:4000/health` | Running-process check; not a full database/integration readiness test |

Example public request:

```bash
curl http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  --data '{"query":"{ games(first: 5) { edges { node { id title } } pageInfo { hasNextPage endCursor } totalCount } }"}'
```

Signed-in requests include:

```http
Authorization: Bearer <supabase-access-token>
```

The API verifies Supabase tokens against public signing keys and resolves the application user in `src/context.ts`. Resolvers enforce authentication and roles. GraphiQL and introspection are enabled only when `NODE_ENV=development`.

## Data model

| Model | Meaning |
|---|---|
| `GameFamily` | Canonical game identity and shared metadata |
| `Game` | A platform-specific release of a family |
| `GameVersion` | Edition label, with per-game release-date overrides |
| `Bundle` | A retail compilation or game-plus-DLC package |
| `UserGame` | A play-library entry, separate from physical ownership |
| `CollectionItem` | A physical game or bundle copy, with region and condition |
| `AchievementSet` | An achievement list with visibility and trophy eligibility |

See [prisma/schema.prisma](prisma/schema.prisma) for the full schema and [CLAUDE.md](CLAUDE.md) for catalog rules. A trophy requires every achievement across every eligible set; non-gating sets remain visible and tickable.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Run the server with TypeScript file watching |
| `npm run generate` | Generate Prisma/Pothos types |
| `npm run lint` | Run ESLint |
| `npm run build` | Generate types and compile to `dist/` |
| `npm start` | Run the compiled server with environment variables supplied |
| `npm run db:studio` | Inspect the configured database |
| `npm run db:migrate` | Create/apply development migrations after reviewing database history |

There is no general `npm test` script. Database verification tools have their own prerequisites. For example, `scripts/verify-trophy-progress.ts` checks trophy progress against a disposable local database. Read a script before running it against any database.

## Layout

| Path | Purpose |
|---|---|
| `src/index.ts`, `src/server.ts` | HTTP server, GraphQL endpoint, CORS, logging |
| `src/context.ts` | Per-request user resolution |
| `src/schema/` | Pothos types, queries, and mutations |
| `src/lib/` | Database, authentication, cache, integrations, shared logic |
| `prisma/` | Schema and migration history |
| `scripts/` | Catalog imports, inspections, repairs, verification |
| `.github/workflows/` | CI configuration |

Scripts named `check-*` inspect data, `import-*` add catalog records, and `fix-*` correct data. They typically run with `npx tsx scripts/<name>.ts`. Imports may need Twitch/IGDB or RetroAchievements credentials. Broad seed jobs are not a prerequisite for starting the server.

## Deployment and development

The [Dockerfile](Dockerfile) builds a Node 20 production image and starts `dist/index.js`. Supply configuration through the deployment environment, use `/health` for the service health check, and plan database migrations separately. See [.railway/README.md](.railway/README.md) for deployment notes.

Run `npm run lint` and `npm run build` before committing code changes.

## Related repositories

- [trophy-rooms-ios](https://github.com/G3mha/trophy-rooms-ios) — native SwiftUI app.
- [trophy-rooms-web](https://github.com/G3mha/trophy-rooms-web) — Next.js client.

## Author

Created and maintained by Enricco Gemha.
