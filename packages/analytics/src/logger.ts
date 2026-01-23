import pino from "pino";
import type { LoggerOptions } from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const pinoConfig: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? "info",
  // In production, we want raw JSON for CloudWatch.
  // In development, we want readable logs.
  transport: !isProduction
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          singleLine: false,
        },
      }
    : undefined,
  serializers: {
    req: (req: Request & { id: string }) => ({
      id: req.id,
      method: req.method,
      url: req.url,
    }),
    error: (e: unknown): string | Record<string, unknown> => {
      if (typeof e === "string") {
        return e;
      }

      if (e instanceof Error) {
        return {
          type: e.constructor.name,
          message: e.message,
          stack: e.stack,
        };
      }

      return String(e);
    },
  },
};

// Export a pre-configured instance for general usage (Next.js, scripts, etc.)
export const logger = pino(pinoConfig);
