import { describe, expect, it } from "vitest";

import { zGrantRole, zShareableRole } from "@repo/api/domains/sharing/sharing.schema";

import {
  SHAREABLE_ROLES,
  collapseRole,
  roleLabelKey,
  shareableRoleLabelKey,
} from "./collaborator-roles";

describe("collaborator role collapse", () => {
  it("collapses the manage-and-edit roles onto 'Can edit'", () => {
    expect(collapseRole("owner")).toBe("admin");
    expect(collapseRole("admin")).toBe("admin");
    expect(roleLabelKey("owner")).toBe("sharing.roleCanEdit");
    expect(roleLabelKey("admin")).toBe("sharing.roleCanEdit");
  });

  it("collapses the read-only role onto 'Can view'", () => {
    expect(collapseRole("viewer")).toBe("viewer");
    expect(roleLabelKey("viewer")).toBe("sharing.roleCanView");
  });

  it("covers every API role exhaustively", () => {
    // Driven off the contract, so a role added there without a label fails here
    // rather than rendering under whichever branch happens to catch it.
    for (const role of zGrantRole.options) {
      expect(SHAREABLE_ROLES).toContain(collapseRole(role));
    }
  });

  it("offers exactly the grantable roles, most access first", () => {
    // The select renders this order, so the contract's order is the UI's order.
    expect(SHAREABLE_ROLES).toEqual(["admin", "viewer"]);
    expect(SHAREABLE_ROLES).toEqual(zShareableRole.options);
    expect(shareableRoleLabelKey("admin")).toBe("sharing.roleCanEdit");
    expect(shareableRoleLabelKey("viewer")).toBe("sharing.roleCanView");
  });

  it("does not offer a role the API refuses on a write", () => {
    // `owner` deserializes on a read and must never be offered as something to grant.
    expect(SHAREABLE_ROLES).not.toContain("owner");
    expect(zShareableRole.safeParse("owner").success).toBe(false);
  });
});
