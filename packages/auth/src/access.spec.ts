import { describe, expect, it } from "vitest";

import { GRANT_ROLES, STAFFING_GRANT_ROLES } from "@repo/database";

import { RESOURCE_ACTIONS, RESOURCE_TYPES, grantRoleCan, orgRoleCan, roles } from "./access";
import type { ResourceAction, ResourceType } from "./access";

/**
 * The capability matrix, pinned action by action. The asymmetry to hold: `contribute`
 * exists on experiments only, and there both the lowest grant tier and plain org
 * membership carry it — on every other type both are read-only.
 *
 * The action and resource-type lists come from the matrix itself rather than being
 * restated here. A copied list would let a new resource type be added to
 * `RESOURCE_TYPES` and the `statement`, forgotten in `grantRoles`, and still leave
 * this suite green — while every grantee was silently read-only on it.
 */
const ALL_ACTIONS: readonly ResourceAction[] = RESOURCE_ACTIONS;

/** Every type except the one that has data to contribute to. */
const TYPES_WITHOUT_DATA: readonly ResourceType[] = RESOURCE_TYPES.filter(
  (type) => type !== "experiment",
);

/** Actions the role is expected to permit; every other action must be refused. */
function expectExactly(
  can: (action: ResourceAction) => boolean,
  allowed: readonly ResourceAction[],
): void {
  for (const action of ALL_ACTIONS) {
    expect({ action, allowed: can(action) }).toEqual({
      action,
      allowed: allowed.includes(action),
    });
  }
}

describe("grant roles", () => {
  it("gives 'viewer' read + contribute, and nothing more", () => {
    expectExactly((a) => grantRoleCan("viewer", "experiment", a), ["read", "contribute"]);
  });

  it("gives 'admin' every action", () => {
    expectExactly((a) => grantRoleCan("admin", "experiment", a), ALL_ACTIONS);
  });

  it("gives 'owner' every action", () => {
    expectExactly((a) => grantRoleCan("owner", "experiment", a), ALL_ACTIONS);
  });

  it("refuses an unknown role outright", () => {
    // `member` is in here as an unknown role, which is what it is: the matrix knows
    // three grant roles and no stored row can carry the retired spelling.
    for (const role of ["bogus", "member"]) {
      for (const resourceType of RESOURCE_TYPES) {
        expectExactly((a) => grantRoleCan(role, resourceType, a), []);
      }
    }
  });

  it("refuses a missing role", () => {
    for (const role of [null, undefined, ""]) {
      expectExactly((a) => grantRoleCan(role, "experiment", a), []);
    }
  });

  it("gives 'viewer' read only on every type that has no data to contribute", () => {
    // A "may add data" signal that answered true where nothing can be added would
    // be a trap for any future surface that reads it generically.
    for (const resourceType of TYPES_WITHOUT_DATA) {
      expectExactly((a) => grantRoleCan("viewer", resourceType, a), ["read"]);
    }
  });

  it("gives 'admin' every action on every resource type", () => {
    // Full control is uniform: these roles hold every verb, contribute included,
    // whether or not a given type has a surface for it.
    for (const resourceType of RESOURCE_TYPES) {
      expectExactly((a) => grantRoleCan("admin", resourceType, a), ALL_ACTIONS);
      expectExactly((a) => grantRoleCan("owner", resourceType, a), ALL_ACTIONS);
    }
  });
});

describe("organization roles", () => {
  it("lets a plain 'member' contribute to the organization's own experiments", () => {
    // A lab's members can add measurements to the lab's experiments: being handed the
    // lowest grant tier should not beat belonging to the organization that owns it.
    expectExactly((a) => orgRoleCan("member", "experiment", a), ["read", "contribute"]);
  });

  it("keeps 'member' read-only on every type with no data to contribute to", () => {
    for (const resourceType of TYPES_WITHOUT_DATA) {
      expectExactly((a) => orgRoleCan("member", resourceType, a), ["read"]);
    }
  });

  it("gives 'admin' every action", () => {
    expectExactly((a) => orgRoleCan("admin", "experiment", a), ALL_ACTIONS);
  });

  it("gives 'owner' every action", () => {
    expectExactly((a) => orgRoleCan("owner", "experiment", a), ALL_ACTIONS);
  });

  it("honours a multi-role string", () => {
    expectExactly((a) => orgRoleCan("member,admin", "experiment", a), ALL_ACTIONS);
    expectExactly((a) => orgRoleCan("member,bogus", "experiment", a), ["read", "contribute"]);
  });

  it("keeps the organization's own settings to its owners", () => {
    // `/organization/update` is gated on exactly this statement, and Better Auth's
    // default admin role carries it — which would let an admin rename the
    // organization or change its slug and directory visibility.
    expect(roles.owner.authorize({ organization: ["update"] }).success).toBe(true);
    expect(roles.admin.authorize({ organization: ["update"] }).success).toBe(false);
    expect(roles.member.authorize({ organization: ["update"] }).success).toBe(false);
  });

  it("leaves the rest of an admin's organization management intact", () => {
    expect(roles.admin.authorize({ member: ["create", "update", "delete"] }).success).toBe(true);
    expect(roles.admin.authorize({ invitation: ["create", "cancel"] }).success).toBe(true);
    expect(roles.admin.authorize({ team: ["create", "update", "delete"] }).success).toBe(true);
  });

  it("still refuses an admin the organization delete owners hold", () => {
    expect(roles.owner.authorize({ organization: ["delete"] }).success).toBe(true);
    expect(roles.admin.authorize({ organization: ["delete"] }).success).toBe(false);
  });
});

describe("the grant and organization middle tiers", () => {
  it("agrees on an experiment: the lowest grant tier and membership both contribute", () => {
    for (const action of ALL_ACTIONS) {
      expect(grantRoleCan("viewer", "experiment", action)).toBe(
        orgRoleCan("member", "experiment", action),
      );
    }
    expect(grantRoleCan("viewer", "experiment", "contribute")).toBe(true);
    expect(orgRoleCan("member", "experiment", "contribute")).toBe(true);
  });

  it("agrees on the other types too, where both are read-only", () => {
    for (const resourceType of TYPES_WITHOUT_DATA) {
      expectExactly((a) => grantRoleCan("viewer", resourceType, a), ["read"]);
      expectExactly((a) => orgRoleCan("member", resourceType, a), ["read"]);
    }
  });

  it("agrees on the full-control roles", () => {
    for (const role of ["owner", "admin"] as const) {
      for (const action of ALL_ACTIONS) {
        expect(grantRoleCan(role, "experiment", action)).toBe(true);
        expect(orgRoleCan(role, "experiment", action)).toBe(true);
      }
    }
  });
});

describe("GRANT_ROLES agrees with the matrix", () => {
  /**
   * `@repo/database` types the grant write helpers with this list, and cannot import
   * the matrix — `@repo/auth` depends on it, so the reverse would be circular. Nothing
   * in the database constrains `resource_grants.role`, so these assertions are the only
   * thing keeping the two definitions honest: a role the writers accept but the matrix
   * cannot resolve is access silently lost.
   */
  it("holds only roles the matrix recognizes, on every resource type", () => {
    for (const role of GRANT_ROLES) {
      for (const resourceType of RESOURCE_TYPES) {
        expect({ role, resourceType, reads: grantRoleCan(role, resourceType, "read") }).toEqual({
          role,
          resourceType,
          reads: true,
        });
      }
    }
  });

  it("holds every role the matrix recognizes", () => {
    // The other direction: a tier added to `grantRoles` that the writers cannot express
    // is a tier nothing can ever be granted.
    const recognized = ["owner", "admin", "viewer", "member", "bogus"].filter((role) =>
      grantRoleCan(role, "experiment", "read"),
    );

    expect([...recognized].sort()).toEqual([...GRANT_ROLES].sort());
  });

  it("does not carry the retired 'member' spelling", () => {
    expect(GRANT_ROLES).not.toContain("member");
  });
});

describe("STAFFING_GRANT_ROLES agrees with the matrix", () => {
  /**
   * `@repo/database` cannot import this matrix — `@repo/auth` depends on it, so the
   * reverse would be circular — and so re-states which roles confer full control.
   * The staffing invariant counts with that list, so a divergence would miscount who
   * is answerable for a resource and could orphan it.
   */
  const ALL_GRANT_ROLES = GRANT_ROLES;

  it("holds exactly the grant roles the matrix gives `manage`", () => {
    const manageCapable = ALL_GRANT_ROLES.filter((role) =>
      grantRoleCan(role, "experiment", "manage"),
    );

    expect([...STAFFING_GRANT_ROLES].sort()).toEqual([...manageCapable].sort());
  });

  it("holds the same set for every resource type", () => {
    for (const resourceType of RESOURCE_TYPES) {
      const manageCapable = ALL_GRANT_ROLES.filter((role) =>
        grantRoleCan(role, resourceType, "manage"),
      );
      expect([...manageCapable].sort()).toEqual([...STAFFING_GRANT_ROLES].sort());
    }
  });
});
