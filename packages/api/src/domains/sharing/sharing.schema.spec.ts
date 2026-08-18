import { describe, expect, it } from "vitest";

import { zPublishableResourceType } from "../visibility/visibility.schema";
import {
  zCreateCollaboratorBody,
  zGrantRole,
  zResourceGrant,
  zShareableRole,
  zSharingResourceType,
  zUpdateCollaboratorBody,
} from "./sharing.schema";

describe("zSharingResourceType", () => {
  it("covers every resource type that can hold a grant, devices included", () => {
    expect([...zSharingResourceType.options].sort()).toEqual([
      "device",
      "device_group",
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
    for (const role of zGrantRole.options) {
      expect(zResourceGrant.safeParse({ ...base, role }).success).toBe(true);
    }
  });

  it("still deserializes a stored 'owner' row", () => {
    // Nothing writes `owner` and no caller may send it, but rows that hold it have to
    // keep listing — which is the whole reason the response enum stays wider.
    expect(zResourceGrant.safeParse({ ...base, role: "owner" }).success).toBe(true);
  });

  it("rejects a role outside the grant-role enum (no unknown role leaks to clients)", () => {
    expect(zResourceGrant.safeParse({ ...base, role: "superuser" }).success).toBe(false);
    // The retired spelling included: it is not a role any longer.
    expect(zResourceGrant.safeParse({ ...base, role: "member" }).success).toBe(false);
  });
});

describe("the grantable role set is narrower than the stored one", () => {
  const body = {
    granteeType: "user" as const,
    granteeId: "33333333-3333-3333-3333-333333333333",
  };

  it("refuses 'owner' on create and update", () => {
    // `owner` means "answerable through the owning organization", which is not
    // something a share can hand over — so it must not be reachable as a write.
    expect(zCreateCollaboratorBody.safeParse({ ...body, role: "owner" }).success).toBe(false);
    expect(zUpdateCollaboratorBody.safeParse({ role: "owner" }).success).toBe(false);
  });

  it("accepts each grantable role on create and update", () => {
    for (const role of zShareableRole.options) {
      expect(zCreateCollaboratorBody.safeParse({ ...body, role }).success).toBe(true);
      expect(zUpdateCollaboratorBody.safeParse({ role }).success).toBe(true);
    }
  });

  it("defaults an omitted create role to the least-privilege tier", () => {
    const parsed = zCreateCollaboratorBody.parse(body);
    expect(parsed.role).toBe("viewer");
  });

  it("is a strict subset of what a response may carry", () => {
    for (const role of zShareableRole.options) {
      expect(zGrantRole.options).toContain(role);
    }
    expect(zShareableRole.options.length).toBeLessThan(zGrantRole.options.length);
  });
});
