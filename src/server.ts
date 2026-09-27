import { createYoga, type Plugin } from "graphql-yoga";
import { NoSchemaIntrospectionCustomRule } from "graphql";
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

const allowedOrigins = new Set(getCorsOrigins());

const isDevelopment = process.env.NODE_ENV === "development";

// Introspection hands a stranger the entire schema, including every admin
// mutation and the shape of every type. It is a development convenience, so
// it stays in development only. Setting graphiql to false hides the IDE but
// does not stop an introspection query, which is why this rule exists as
// well as that flag.
const disableIntrospection: Plugin = {
  onValidate({ addValidationRule }) {
    addValidationRule(NoSchemaIntrospectionCustomRule);
  },
};

function isAllowedOrigin(origin: string): boolean {
  if (allowedOrigins.has(origin)) return true;

  try {
    const url = new URL(origin);

    // Allow localhost in development
    if (
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    ) {
      return true;
    }

    // Only HTTPS for production domains
    if (url.protocol !== "https:") return false;

    // trophyrooms.org and all subdomains
    if (
      url.hostname === "trophyrooms.org" ||
      url.hostname.endsWith(".trophyrooms.org")
    ) {
      return true;
    }

    // Vercel preview deployments
    if (url.hostname.endsWith(".vercel.app")) return true;

    return false;
  } catch {
    return false;
  }
}

export const yoga = createYoga({
  schema,
  context: ({ request }) => createContext(request),
  cors: (request) => {
    const origin = request.headers.get("origin");

    // No Origin = same-origin or non-browser (curl, GraphiQL)
    if (!origin) {
      return {
        origin: "*",
        credentials: false,
        methods: ["POST", "GET", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
      };
    }

    if (isAllowedOrigin(origin)) {
      return {
        origin,
        credentials: true,
        methods: ["POST", "GET", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        maxAge: 86400,
      };
    }

    logger.warn({ origin }, "Blocked CORS request from unknown origin");
    return false;
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
    isDev: isDevelopment,
  },
  plugins: isDevelopment ? [] : [disableIntrospection],
  graphiql: isDevelopment && {
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
