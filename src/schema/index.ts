import { builder } from "./builder.js";

// Import all types to register them
import "./types/index.js";

// Import all queries to register them
import "./queries/index.js";

// Import all mutations to register them
import "./mutations/index.js";

// Build and export the schema
export const schema = builder.toSchema();
