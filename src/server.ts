import { createYoga } from "graphql-yoga";
import { schema } from "./schema/index.js";
import { createContext } from "./context.js";
import { logger } from "./lib/logger.js";

// Parse CORS origins from environment
function getCorsOrigins(): string[] {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  return frontendUrl
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
}

const corsOrigins = new Set(getCorsOrigins());

function isAllowedOrigin(origin: string | undefined | null): boolean {
  if (!origin) return true;
  if (corsOrigins.has(origin)) return true;
  if (origin.endsWith(".trophyrooms.org")) return true;
  if (origin.endsWith(".vercel.app")) return true;
  return false;
}

export const yoga = createYoga({
  schema,
  context: ({ request }) => createContext(request),
  cors: {
    origin: (origin) => {
      if (isAllowedOrigin(origin)) {
        return origin ?? true;
      }
      logger.warn({ origin }, "Blocked CORS origin");
      return false;
    },
    credentials: true,
    methods: ["POST", "GET", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  graphqlEndpoint: "/graphql",
  healthCheckEndpoint: "/health",
  logging: {
    debug: (...args) => logger.debug(args, "GraphQL debug"),
    info: (...args) => logger.info(args, "GraphQL info"),
    warn: (...args) => logger.warn(args, "GraphQL warn"),
    error: (...args) => logger.error(args, "GraphQL error"),
  },
  maskedErrors: {
    isDev: process.env.NODE_ENV === "development",
  },
  graphiql: {
    title: "Trophy Rooms GraphQL API",
    defaultQuery: `# Welcome to Trophy Rooms GraphQL API
#
# Try these example queries:

# List all games
query GetGames {
  games(first: 10) {
    edges {
      node {
        id
        title
        description
        achievementCount
        trophyCount
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}

# Get current user (requires authentication)
query GetMe {
  me {
    id
    name
    email
    achievementCount
    trophyCount
  }
}
`,
  },
});
