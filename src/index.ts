import { createServer } from "node:http";
import { yoga } from "./server.js";
import { logger } from "./lib/logger.js";

const port = parseInt(process.env.PORT || "4000", 10);

const server = createServer(yoga);

server.listen(port, () => {
  logger.info(
    {
      port,
      graphqlEndpoint: `http://localhost:${port}/graphql`,
      healthEndpoint: `http://localhost:${port}/health`,
    },
    "Trophy Rooms GraphQL server is running"
  );
});

// Graceful shutdown
process.on("SIGINT", () => {
  logger.info("Received SIGINT, shutting down gracefully...");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  logger.info("Received SIGTERM, shutting down gracefully...");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});
