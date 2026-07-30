import { describe, expect, it } from "vitest";

import { zPublishableResourceType } from "../visibility/visibility.schema";
import { zResourceGrant, zSharingResourceType } from "./sharing.schema";

describe("zSharingResourceType", () => {
  it("covers every resource type that can hold a grant, devices included", () => {
    expect([...zSharingResourceType.options].sort()).toEqual([
      "device",
      "experiment",
      "macro",
      "protocol",
      "workbook",
    ]);
  });

  it("is the publishable set plus devices — shareable and publishable are not the same question", () => {
    // A device can be shared but never published: it stays private for good, so no
    // route may write its visibility.
    expect([...zPublishableResourceType.options].sort()).toEqual([
      "experiment",
      "macro",
      "protocol",
      "workbook",
    ]);
    expect(zPublishableResourceType.safeParse("device").success).toBe(false);
  });
});

describe("zResourceGrant response schema", () => {
  const base = {
    id: "11111111-1111-1111-1111-111111111111",
    resourceType: "macro" as const,
    resourceId: "22222222-2222-2222-2222-222222222222",
    granteeType: "user" as const,
    granteeId: "33333333-3333-3333-3333-333333333333",
    createdAt: "2026-07-22T00:00:00.000Z",
    createdBy: null,
    isOutsideCollaborator: true,
    grantee: { type: "user" as const, displayName: null, email: null, avatarUrl: null },
  };

  it("accepts every grant-role enum value", () => {
    for (const role of ["owner", "admin", "member", "viewer"] as const) {
      expect(zResourceGrant.safeParse({ ...base, role }).success).toBe(true);
    }
  });

  it("rejects a role outside the grant-role enum (no unknown role leaks to clients)", () => {
    expect(zResourceGrant.safeParse({ ...base, role: "superuser" }).success).toBe(false);
  });
});
