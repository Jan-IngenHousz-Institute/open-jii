import { basePermissionCan, roleCan } from "./abilities";
import type { ResourceAction } from "./abilities";

const ALL_ACTIONS: ResourceAction[] = ["read", "update", "share", "manage"];

describe("roleCan", () => {
  it("grants owner and admin every action", () => {
    for (const role of ["owner", "admin"]) {
      for (const action of ALL_ACTIONS) {
        expect(roleCan(role, action)).toBe(true);
      }
    }
  });

  it("grants member and viewer read only", () => {
    for (const role of ["member", "viewer"]) {
      expect(roleCan(role, "read")).toBe(true);
      for (const action of ALL_ACTIONS.filter((a) => a !== "read")) {
        expect(roleCan(role, action)).toBe(false);
      }
    }
  });

  it("grants nothing for an unknown or empty role", () => {
    expect(roleCan("bogus", "read")).toBe(false);
    expect(roleCan("", "read")).toBe(false);
  });

  it("honors a comma-separated multi-role if any token grants the action", () => {
    expect(roleCan("viewer,admin", "update")).toBe(true);
    expect(roleCan("member, viewer", "update")).toBe(false);
    expect(roleCan("member,viewer", "read")).toBe(true);
  });
});

describe("basePermissionCan", () => {
  it("admin base permits every action", () => {
    for (const action of ALL_ACTIONS) {
      expect(basePermissionCan("admin", action)).toBe(true);
    }
  });

  it("read base permits read only", () => {
    expect(basePermissionCan("read", "read")).toBe(true);
    for (const action of ALL_ACTIONS.filter((a) => a !== "read")) {
      expect(basePermissionCan("read", action)).toBe(false);
    }
  });

  it("none base permits nothing", () => {
    for (const action of ALL_ACTIONS) {
      expect(basePermissionCan("none", action)).toBe(false);
    }
  });
});
