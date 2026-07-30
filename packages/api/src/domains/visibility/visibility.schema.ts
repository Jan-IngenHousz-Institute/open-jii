import { z } from "zod";

import { zSharingResourceType } from "../sharing/sharing.schema";

/**
 * Visibility of an org-scoped resource. `private|public` for every shareable
 * type (experiment/macro/protocol/workbook share this two-value model — the DB
 * uses `experiment_visibility` for experiments and `visibility` for the rest,
 * both `private|public`).
 */
export const zVisibility = z.enum(["private", "public"]);

/**
 * The resource types that can actually be published — the shareable types minus
 * devices.
 *
 * Devices carry a `visibility` column like everything else, but nothing may write
 * it: a device is a piece of hardware registered to an organization, and its
 * AWS Thing, certificates and ingest topic are not artifacts anyone can publish.
 * Deriving this from {@link zSharingResourceType} rather than listing four
 * literals is what makes the exclusion load-bearing — the publish use-case and
 * repository take *this* type, so a device cannot be routed into them even by
 * mistake, and a future type added to sharing has to state its position here.
 */
export const zPublishableResourceType = zSharingResourceType.exclude(["device"]);

export type PublishableResourceType = z.infer<typeof zPublishableResourceType>;

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
