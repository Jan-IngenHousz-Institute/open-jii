import type { Logger } from "@nestjs/common";
import { ORPCError } from "@orpc/nest";

import type { AppError, Failure } from "./fp-utils";

const ORPC_CODE_BY_STATUS: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "UNPROCESSABLE_CONTENT",
  429: "TOO_MANY_REQUESTS",
};

export function throwOrpcError(
  error: AppError,
  logger: Logger,
  operation?: string,
  context?: string,
): never {
  const logObject: Record<string, unknown> = { msg: error.message, errorCode: error.code };
  if (operation) logObject.operation = operation;
  if (context) logObject.context = context;
  if (error.details) logObject.details = error.details;

  if (error.statusCode >= 500) {
    logger.error(logObject);
  } else {
    logger.warn(logObject);
  }

  throw new ORPCError(ORPC_CODE_BY_STATUS[error.statusCode] ?? "INTERNAL_SERVER_ERROR", {
    status: error.statusCode,
    message: error.message,
    data: {
      code: error.code,
      ...(process.env.NODE_ENV !== "production" && error.details ? { details: error.details } : {}),
    },
  });
}

export function throwOrpcFailure(
  failure: Failure<AppError>,
  logger: Logger,
  operation?: string,
  context?: string,
): never {
  return throwOrpcError(failure.error, logger, operation, context);
}
