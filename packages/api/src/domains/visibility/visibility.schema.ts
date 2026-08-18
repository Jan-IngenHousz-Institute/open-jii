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
 * devices, which carry a `visibility` column but have no publish path (their AWS
 * Thing, certificates and ingest topic are not artifacts anyone can publish).
 *
 * Derived from {@link zSharingResourceType} rather than listing four literals so
 * the exclusion is load-bearing: the publish use-case and repository take *this*
 * type, and a future shareable type has to state its position here.
 */
export const zPublishableResourceType = zSharingResourceType.exclude(["device", "device_group"]);

export type PublishableResourceType = z.infer<typeof zPublishableResourceType>;

/**
 * Body of the `setVisibility` route. Deliberately admits any valid visibility value
 * rather than only `public`, so the full transition matrix (including same-state
 * no-ops and the rejected public→private) reaches the backend, where the shared
 * `visibility-transition` helper is the single enforcement point.
 */
export const zSetVisibilityBody = z.object({
  visibility: zVisibility,
});

/**
 * Response of a `setVisibility` call. Generic across resource types so one shape
 * serves every route and the UI can update local state without a follow-up fetch.
 */
export const zSetVisibilityResponse = z.object({
  id: z.string().uuid(),
  visibility: zVisibility,
});

export type Visibility = z.infer<typeof zVisibility>;
export type SetVisibilityBody = z.infer<typeof zSetVisibilityBody>;
export type SetVisibilityResponse = z.infer<typeof zSetVisibilityResponse>;
