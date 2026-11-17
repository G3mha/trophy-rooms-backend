# Trophy Rooms API

The GraphQL API for [Trophy Rooms](https://trophyrooms.org). Stores games, collections, play sessions, and achievement progress for the iOS and web apps.

Built with TypeScript, GraphQL Yoga, Pothos, Prisma, and PostgreSQL. Supabase handles sign-in. Redis is optional.

## Run it

You need Node.js 20+, PostgreSQL, and a Supabase project with asymmetric JWT signing keys.

```bash
git clone https://github.com/G3mha/trophy-rooms-backend.git
cd trophy-rooms-backend
cp .env.example .env
npm ci
```

Fill in the database and Supabase values in `.env`. Remove `REDIS_URL` if you aren't running Redis. Use a separate development database.

```bash
set -a
. ./.env
set +a
npm run db:push
npm run dev
```

Use `db:push` only to initialize a disposable development database. The API starts at `http://localhost:4000/graphql`; GraphiQL is available with `NODE_ENV=development`. Authenticated requests use a Supabase bearer token.

Run `npm run lint` and `npm run build` to check code changes. See [.env.example](.env.example) for configuration and [prisma/schema.prisma](prisma/schema.prisma) for the data model.

## Related

- [iOS app](https://github.com/G3mha/trophy-rooms-ios)
- [Web app](https://github.com/G3mha/trophy-rooms-web)
