import { createOrganizationResource } from "@/test/factories";
import { describe, expect, it } from "vitest";

import type { OrganizationResourceType } from "@repo/api/domains/organization/organization.schema";

import { pickFeaturedResources } from "./organization-featured-selection";

/** A resource of `type` with a known collaborator count, named so it is identifiable. */
function resource(
  type: OrganizationResourceType,
  collaboratorCount: number,
  extra: { id?: string; updatedAt?: string } = {},
) {
  return createOrganizationResource({
    type,
    collaboratorCount,
    id: extra.id ?? `${type}-${collaboratorCount}`,
    name: `${type} ${collaboratorCount}`,
    updatedAt: extra.updatedAt ?? "2026-01-01T00:00:00.000Z",
  });
}

const typesOf = (resources: { type: string }[]) => resources.map((row) => row.type);

describe("pickFeaturedResources", () => {
  it("rotates through the types rather than ranking them flat", () => {
    // Experiments hold every one of the highest counts. A flat top-6 would return six
    // experiments and make the card a copy of the group below it.
    const resources = [
      ...[9, 8, 7, 6, 5].map((n) => resource("experiment", n)),
      ...[4, 3].map((n) => resource("protocol", n)),
      resource("macro", 2),
      resource("workbook", 1),
    ];

    expect(typesOf(pickFeaturedResources(resources))).toEqual([
      "experiment",
      "protocol",
      "macro",
      "workbook",
      "experiment",
      "protocol",
    ]);
  });

  it("redistributes the slots of a type that runs out mid-fill", () => {
    // Protocols and macros have one each, so rounds two and three fall to the types
    // that still have something — the card fills rather than coming up short.
    const resources = [
      ...[9, 8, 7, 6].map((n) => resource("experiment", n)),
      resource("protocol", 5),
      resource("macro", 4),
      ...[3, 2].map((n) => resource("workbook", n)),
    ];

    const featured = pickFeaturedResources(resources);
    expect(featured).toHaveLength(6);
    expect(typesOf(featured)).toEqual([
      "experiment",
      "protocol",
      "macro",
      "workbook",
      "experiment",
      "workbook",
    ]);
  });

  it("fills six slots from a single type when that is all the organization has", () => {
    const resources = [9, 8, 7, 6, 5, 4, 3].map((n) => resource("experiment", n));

    const featured = pickFeaturedResources(resources);
    expect(featured).toHaveLength(6);
    // Still ranked by collaborator count, so the seventh left out is the least held.
    expect(featured.map((row) => row.collaboratorCount)).toEqual([9, 8, 7, 6, 5, 4]);
  });

  it("returns everything there is when the organization has fewer than six", () => {
    const resources = [resource("experiment", 3), resource("workbook", 1)];

    expect(typesOf(pickFeaturedResources(resources))).toEqual(["experiment", "workbook"]);
  });

  it("returns nothing for an organization with no resources", () => {
    expect(pickFeaturedResources([])).toEqual([]);
  });

  it("breaks a tie on collaborator count by what moved most recently", () => {
    const resources = [
      resource("experiment", 4, { id: "older", updatedAt: "2026-01-01T00:00:00.000Z" }),
      resource("experiment", 4, { id: "newest", updatedAt: "2026-03-01T00:00:00.000Z" }),
      resource("experiment", 4, { id: "middle", updatedAt: "2026-02-01T00:00:00.000Z" }),
    ];

    expect(pickFeaturedResources(resources).map((row) => row.id)).toEqual([
      "newest",
      "middle",
      "older",
    ]);
  });

  it("can feature a device when its collaborator count earns it", () => {
    // Devices flow in from the same array as everything else. Excluding them would put
    // a type in the resources card and the estate bar that the featured card pretends
    // does not exist — and a device several people hold is legitimately notable.
    const resources = [resource("experiment", 2), resource("device", 9), resource("workbook", 1)];

    const featured = pickFeaturedResources(resources);
    expect(typesOf(featured)).toEqual(["experiment", "workbook", "device"]);
    // Ranked within its own type and filled by rotation, so a high-count device does
    // not jump the rotation — it takes the device slot.
    expect(featured.map((row) => row.collaboratorCount)).toEqual([2, 1, 9]);
  });

  it("rotates devices last, matching the order the resources card groups by", () => {
    const resources = [
      ...[9, 8].map((n) => resource("experiment", n)),
      resource("protocol", 7),
      resource("macro", 6),
      resource("workbook", 5),
      ...[4, 3].map((n) => resource("device", n)),
    ];

    expect(typesOf(pickFeaturedResources(resources))).toEqual([
      "experiment",
      "protocol",
      "macro",
      "workbook",
      "device",
      "experiment",
    ]);
  });

  it("does not consume the caller's array", () => {
    // The fill shifts off per-type queues; doing that to the caller's list would empty
    // the resources card rendered from the same array.
    const resources = [resource("experiment", 2), resource("protocol", 1)];

    pickFeaturedResources(resources);

    expect(resources).toHaveLength(2);
  });
});
