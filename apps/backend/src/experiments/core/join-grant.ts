import type { GrantRole } from "@repo/database";

/**
 * The tier both self-serve routes into an experiment hand out: approving a join
 * request and redeeming a join code write the same `resource_grants` row. Stored as
 * `viewer`, which the sharing UI calls "Can view" and which carries `contribute` on
 * an experiment — the tier that lets someone measure.
 */
export const JOIN_GRANT_ROLE: GrantRole = "viewer";
