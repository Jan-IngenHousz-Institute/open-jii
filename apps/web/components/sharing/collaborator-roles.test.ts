import { describe, expect, it } from "vitest";

import type { GrantRole } from "@repo/api/domains/sharing/sharing.schema";

import {
  DEFAULT_SHARE_ROLE,
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

  it("collapses the read-only roles onto 'Can view'", () => {
    expect(collapseRole("member")).toBe("viewer");
    expect(collapseRole("viewer")).toBe("viewer");
    expect(roleLabelKey("member")).toBe("sharing.roleCanView");
    expect(roleLabelKey("viewer")).toBe("sharing.roleCanView");
  });

  it("covers every API role exhaustively", () => {
    const allRoles: GrantRole[] = ["owner", "admin", "member", "viewer"];
    for (const role of allRoles) {
      expect(SHAREABLE_ROLES).toContain(collapseRole(role));
    }
  });

  it("offers exactly the two UI roles, most access first", () => {
    expect(SHAREABLE_ROLES).toEqual(["admin", "viewer"]);
    expect(shareableRoleLabelKey("admin")).toBe("sharing.roleCanEdit");
    expect(shareableRoleLabelKey("viewer")).toBe("sharing.roleCanView");
  });

  it("defaults a new share to least privilege", () => {
    expect(DEFAULT_SHARE_ROLE).toBe("viewer");
  });
});
