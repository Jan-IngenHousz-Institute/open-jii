import { z } from "zod/mini";

const apiHealthSchema = z.object({ status: z.literal("ok") });

/** A page that renders the product's name is up; an empty 200 from a broken deploy is not. */
export function isWebsiteHealthy(body: string): boolean {
  return body.includes("openJII");
}

/** The API's anonymous health endpoint answers `{"status":"ok"}` while it serves. */
export function isApiHealthy(body: string): boolean {
  try {
    return apiHealthSchema.safeParse(JSON.parse(body)).success;
  } catch {
    return false;
  }
}
