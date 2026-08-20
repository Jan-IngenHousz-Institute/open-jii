import { describe, expect, it } from "vitest";

import {
  assignableRoles,
  canManageRoster,
  countOwners,
  invitableRoles,
  leaveRejection,
  removeRejection,
} from "./organization-roster-rules";

const owner = { userId: "u-owner", role: "owner" } as const;
const secondOwner = { userId: "u-owner-2", role: "owner" } as const;
const admin = { userId: "u-admin", role: "admin" } as const;
const member = { userId: "u-member", role: "member" } as const;

describe("canManageRoster", () => {
  it.each([
    ["owner", true],
    ["admin", true],
    ["member", false],
  ] as const)("%s → %s", (role, expected) => {
    expect(canManageRoster(role)).toBe(expected);
  });

  it("treats a non-member as unable to manage anything", () => {
    expect(canManageRoster(null)).toBe(false);
  });
});

describe("assignableRoles", () => {
  it("offers a plain member nothing to change", () => {
    expect(assignableRoles(member, admin, 2)).toEqual([]);
  });

  it("lets an owner hand out every role, owner included", () => {
    expect(assignableRoles(owner, member, 1)).toEqual(["owner", "admin", "member"]);
  });

  it("does not let an admin hand out the owner role", () => {
    expect(assignableRoles(admin, member, 1)).toEqual(["admin", "member"]);
  });

  it("does not let an admin touch an owner at all", () => {
    expect(assignableRoles(admin, owner, 2)).toEqual([]);
  });

  it("refuses to demote the last owner, even to another owner", () => {
    expect(assignableRoles(owner, owner, 1)).toEqual([]);
    expect(assignableRoles(secondOwner, owner, 1)).toEqual([]);
  });

  it("allows demoting an owner once a second one exists", () => {
    expect(assignableRoles(owner, secondOwner, 2)).toEqual(["owner", "admin", "member"]);
  });

  it("lets an owner demote themselves while another owner remains", () => {
    expect(assignableRoles(owner, owner, 2)).toEqual(["owner", "admin", "member"]);
  });
});

describe("removeRejection", () => {
  it("refuses a plain member the action entirely", () => {
    expect(removeRejection(member, admin, 2)).toBe("notPermitted");
  });

  it("refuses an admin against an owner", () => {
    expect(removeRejection(admin, owner, 2)).toBe("notPermitted");
  });

  it("lets an admin remove members and other admins", () => {
    expect(removeRejection(admin, member, 1)).toBeNull();
    expect(removeRejection(admin, { userId: "u-a2", role: "admin" }, 1)).toBeNull();
  });

  it("names the last-owner floor as its own reason, not a permission problem", () => {
    // The distinction is what the row renders: a disabled button with a reason,
    // rather than no button at all.
    expect(removeRejection(owner, owner, 1)).toBe("lastOwner");
    expect(removeRejection(owner, secondOwner, 2)).toBeNull();
  });
});

describe("leaveRejection", () => {
  it("lets anyone but the last owner leave", () => {
    expect(leaveRejection("member", 1)).toBeNull();
    expect(leaveRejection("admin", 1)).toBeNull();
    expect(leaveRejection("owner", 2)).toBeNull();
  });

  it("refuses the last owner", () => {
    expect(leaveRejection("owner", 1)).toBe("lastOwner");
  });
});

describe("invitableRoles", () => {
  it("gives a plain member nothing to offer", () => {
    expect(invitableRoles("member")).toEqual([]);
    expect(invitableRoles(null)).toEqual([]);
  });

  it("keeps the owner role to owners", () => {
    expect(invitableRoles("owner")).toEqual(["owner", "admin", "member"]);
    expect(invitableRoles("admin")).toEqual(["admin", "member"]);
  });
});

describe("countOwners", () => {
  it("counts only the owner role", () => {
    expect(
      countOwners([{ role: "owner" }, { role: "admin" }, { role: "member" }, { role: "owner" }]),
    ).toBe(2);
    expect(countOwners([])).toBe(0);
  });
});
