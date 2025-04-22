import { Logger } from "@nestjs/common";
import { StatusCodes } from "http-status-codes";
import { z } from "validator";

/**
 * Maps application errors to standardized API responses
 * @param error The error that was thrown
 * @param logger Logger instance for recording error details
 * @returns An API response object with appropriate status code and error message
 */
export function handleApiError(error: unknown, logger: Logger) {
  // Extract error message or use a default
  const message =
    error instanceof Error ? error.message : "An unknown error occurred";

  // Handle ZodError (validation errors)
  if (error instanceof z.ZodError) {
    const formattedError = error.format();
    logger.warn(`Validation error: ${JSON.stringify(formattedError)}`);
    return {
      status: StatusCodes.BAD_REQUEST as const,
      body: {
        message: "Validation error",
        details: formattedError,
      },
    };
  }

  // Handle NotFoundError
  if (message.toLowerCase().includes("not found")) {
    logger.warn(`Resource not found: ${message}`);
    return {
      status: StatusCodes.NOT_FOUND as const,
      body: { message },
    };
  }

  // Handle permission/authorization errors
  if (
    message.toLowerCase().includes("permission") ||
    message.toLowerCase().includes("unauthorized") ||
    message.toLowerCase().includes("forbidden")
  ) {
    logger.warn(`Permission error: ${message}`);
    return {
      status: StatusCodes.FORBIDDEN as const,
      body: { message },
    };
  }

  // Handle UUID format errors
  if (message.toLowerCase().includes("uuid")) {
    logger.warn(`Invalid UUID format: ${message}`);
    return {
      status: StatusCodes.BAD_REQUEST as const,
      body: { message },
    };
  }

  // Handle other client errors
  if (
    message.toLowerCase().includes("invalid") ||
    message.toLowerCase().includes("required")
  ) {
    logger.warn(`Bad request: ${message}`);
    return {
      status: StatusCodes.BAD_REQUEST as const,
      body: { message },
    };
  }

  // Log the full error for server errors
  logger.error(
    `Internal server error: ${message}`,
    error instanceof Error ? error.stack : undefined,
  );

  // Default to internal server error
  return {
    status: StatusCodes.INTERNAL_SERVER_ERROR as const,
    body: {
      message: "An internal server error occurred",
      // Only include detailed error in non-production environments
      ...(process.env.NODE_ENV !== "production" && { details: message }),
    },
  };
}
