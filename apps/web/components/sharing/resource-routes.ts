import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

/** Shared platform route segment for each resource type. */
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
