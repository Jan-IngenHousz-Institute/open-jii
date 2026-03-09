import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

export const zHealthTimeResponse = z.object({
  utcTimestamp: z.number(),
  iso: z.string(),
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
