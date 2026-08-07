import { z } from "zod";

/**
 * What the caller may do with one resource, resolved server-side by `can()`. A
 * rendering signal only — every mutating route stays guarded. `read` is absent:
 * holding the detail response implies it.
 */
export const zResourceCapabilities = z.object({
  /** `can(contribute)`: add data, not edit the resource. Experiments only. */
  canContribute: z.boolean(),
  /** `can(update)`: edit content and settings. */
  canUpdate: z.boolean(),
  /** `can(manage)`: manage the resource, publishing included. */
  canManage: z.boolean(),
  /** `can(share)`: create, change and revoke grants. */
  canShare: z.boolean(),
  /** Holds a direct user grant, so has a row to give up. Last admin still refused. */
  canLeave: z.boolean(),
});

export type ResourceCapabilities = z.infer<typeof zResourceCapabilities>;
