import SchemaBuilder from "@pothos/core";
import PrismaPlugin from "@pothos/plugin-prisma";
import RelayPlugin from "@pothos/plugin-relay";
import type PrismaTypes from "../generated/pothos-types.js";
import { getDatamodel } from "../generated/pothos-types.js";
import { prisma } from "../lib/prisma.js";
import type { Context } from "../context.js";
import { ErrorCode } from "../lib/errors.js";

export const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  Context: Context;
  Scalars: {
    DateTime: {
      Input: Date;
      Output: Date;
    };
  };
}>({
  plugins: [PrismaPlugin, RelayPlugin],
  prisma: {
    client: prisma,
    dmmf: getDatamodel(),
    filterConnectionTotalCount: true,
    onUnusedQuery: process.env.NODE_ENV === "production" ? null : "warn",
  },
  relay: {
    clientMutationId: "omit",
    cursorType: "String",
  },
});

// DateTime scalar
builder.scalarType("DateTime", {
  serialize: (value) => value.toISOString(),
  parseValue: (value) => {
    if (typeof value !== "string") {
      throw new Error("DateTime must be a string");
    }
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new Error("Invalid DateTime format");
    }
    return date;
  },
});

// Error code enum for mutations
builder.enumType(ErrorCode, {
  name: "ErrorCode",
});

// Mutation error type
export const MutationErrorRef = builder.objectRef<{
  code: ErrorCode;
  message: string;
  field: string | null;
}>("MutationError");

MutationErrorRef.implement({
  fields: (t) => ({
    code: t.expose("code", { type: ErrorCode }),
    message: t.exposeString("message"),
    field: t.exposeString("field", { nullable: true }),
  }),
});

// Bulk delete result type for admin operations
export const BulkDeleteResultRef = builder.objectRef<{
  success: boolean;
  deletedCount: number;
  error: { code: ErrorCode; message: string; field: string | null } | null;
}>("BulkDeleteResult");

BulkDeleteResultRef.implement({
  fields: (t) => ({
    success: t.exposeBoolean("success"),
    deletedCount: t.exposeInt("deletedCount"),
    error: t.field({
      type: MutationErrorRef,
      nullable: true,
      resolve: (result) => result.error,
    }),
  }),
});

// Initialize query and mutation types
builder.queryType({});
builder.mutationType({});
