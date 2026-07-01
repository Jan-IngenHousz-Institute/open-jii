import { oc } from "@orpc/contract";
import { z } from "zod";

export const zHealthTimeResponse = z.object({
  utcTimestampMs: z.number().describe("Milliseconds since Unix epoch"),
  utcTimestampSec: z.number().describe("Seconds since Unix epoch (floored)"),
  iso: z.string().describe("ISO 8601 UTC string"),
});

export type HealthTimeResponse = z.infer<typeof zHealthTimeResponse>;

export const healthOrpcContract = {
  getTime: oc
    .route({ method: "GET", path: "/health/time", successStatus: 200 })
    .output(zHealthTimeResponse),
};
