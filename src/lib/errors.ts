import { GraphQLError } from "graphql";

export enum ErrorCode {
  NOT_FOUND = "NOT_FOUND",
  ALREADY_EXISTS = "ALREADY_EXISTS",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

export class AppError extends GraphQLError {
  constructor(message: string, code: ErrorCode, field?: string) {
    super(message, {
      extensions: {
        code,
        field,
      },
    });
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id
      ? `${resource} with id "${id}" not found`
      : `${resource} not found`;
    super(message, ErrorCode.NOT_FOUND);
  }
}

export class AlreadyExistsError extends AppError {
  constructor(resource: string, field: string, value: string) {
    super(
      `${resource} with ${field} "${value}" already exists`,
      ErrorCode.ALREADY_EXISTS,
      field
    );
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "You must be logged in to perform this action") {
    super(message, ErrorCode.UNAUTHORIZED);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, field: string) {
    super(message, ErrorCode.VALIDATION_ERROR, field);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super(message, ErrorCode.FORBIDDEN);
  }
}

// Mutation result helper types
export interface MutationError {
  code: ErrorCode;
  message: string;
  field: string | null;
}

export function createMutationError(
  code: ErrorCode,
  message: string,
  field?: string
): MutationError {
  return {
    code,
    message,
    field: field ?? null,
  };
}
