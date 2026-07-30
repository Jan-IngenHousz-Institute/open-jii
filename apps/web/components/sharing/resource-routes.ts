import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

/**
 * The platform route segment each shareable resource type lives under, i.e. the
 * plural in `/{locale}/platform/{segment}` and `/{locale}/platform/{segment}/{id}`.
 *
 * One map rather than one per caller: the detail tab strip, the collaborators
 * route and the leave action all need to name the same routes, and a resource
 * type that ever moved would otherwise drift between them.
 */
export const RESOURCE_ROUTE_SEGMENTS: Record<SharingResourceType, string> = {
  experiment: "experiments",
  macro: "macros",
  protocol: "protocols",
  workbook: "workbooks",
  device: "devices",
};

/** The resource's own detail route — the Overview of its tab strip. */
export function resourceDetailPath(
  locale: string,
  resourceType: SharingResourceType,
  resourceId: string,
): string {
  return `/${locale}/platform/${RESOURCE_ROUTE_SEGMENTS[resourceType]}/${resourceId}`;
}

/** The resource's Collaborators route — a route on every type, not an in-page tab. */
export function resourceCollaboratorsPath(
  locale: string,
  resourceType: SharingResourceType,
  resourceId: string,
): string {
  return `${resourceDetailPath(locale, resourceType, resourceId)}/collaborators`;
}
