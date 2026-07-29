import { z } from "zod";

/**
 * Visibility of an org-scoped resource. `private|public` for every shareable
 * type (experiment/macro/protocol/workbook share this two-value model — the DB
 * uses `experiment_visibility` for experiments and `visibility` for the rest,
 * both `private|public`).
 */
export const zVisibility = z.enum(["private", "public"]);

/**
 * Body of the dedicated `setVisibility` route (a `PATCH .../{id}/visibility`
 * per resource type). The monotonic rule (private→public only) is
 * enforced server-side by the shared `visibility-transition` helper, not here —
 * this schema only constrains the target to a valid visibility value so the
 * full transition matrix (including same-state no-ops) can reach the backend.
 */
export const zSetVisibilityBody = z.object({
  visibility: zVisibility,
});

/**
 * Response of a `setVisibility` call: the resource id and its resulting
 * visibility. Generic across resource types so one shape serves every route and
 * the UI can update local state without a follow-up fetch.
 */
export const zSetVisibilityResponse = z.object({
  id: z.string().uuid(),
  visibility: zVisibility,
});

export type Visibility = z.infer<typeof zVisibility>;
export type SetVisibilityBody = z.infer<typeof zSetVisibilityBody>;
export type SetVisibilityResponse = z.infer<typeof zSetVisibilityResponse>;
