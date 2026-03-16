import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

export const zHealthTimeResponse = z.object({
  utcTimestampMs: z.number().describe("Milliseconds since Unix epoch"),
  utcTimestampSec: z.number().describe("Seconds since Unix epoch (floored)"),
  iso: z.string().describe("ISO 8601 UTC string"),
});

export type HealthTimeResponse = z.infer<typeof zHealthTimeResponse>;

export const healthContract = c.router({
  getTime: {
    method: "GET",
    path: "/health/time",
    responses: {
      200: zHealthTimeResponse,
    },
    summary: "Get server time",
    description: "Returns the current server UTC timestamp for time synchronization.",
  },
});
