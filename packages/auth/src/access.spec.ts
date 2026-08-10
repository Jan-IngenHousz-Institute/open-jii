import { describe, expect, it } from "vitest";

import { GRANT_ROLES, STAFFING_GRANT_ROLES } from "@repo/database";

import { RESOURCE_ACTIONS, RESOURCE_TYPES, grantRoleCan, orgRoleCan } from "./access";
import type { ResourceAction, ResourceType } from "./access";

/**
 * The capability matrix, pinned action by action. Two asymmetries to hold: a grant
 * of "Can view" carries `contribute` where an org `member` role does not, and
 * `contribute` exists on experiments only.
 *
 * The action and resource-type lists come from the matrix itself rather than being
 * restated here. A copied list would let a sixth resource type be added to
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

  it("treats an old-pod-written 'member' grant exactly like 'viewer'", () => {
    expectExactly((a) => grantRoleCan("member", "experiment", a), ["read", "contribute"]);
    for (const resourceType of TYPES_WITHOUT_DATA) {
      expectExactly((a) => grantRoleCan("member", resourceType, a), ["read"]);
    }
  });

  it("refuses an unknown role outright", () => {
    for (const role of ["bogus"]) {
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
  it("keeps the plain 'member' role read-only — org membership is not contribution", () => {
    expectExactly((a) => orgRoleCan("member", "experiment", a), ["read"]);
  });

  it("gives 'admin' every action", () => {
    expectExactly((a) => orgRoleCan("admin", "experiment", a), ALL_ACTIONS);
  });

  it("gives 'owner' every action", () => {
    expectExactly((a) => orgRoleCan("owner", "experiment", a), ALL_ACTIONS);
  });

  it("honours a multi-role string", () => {
    expectExactly((a) => orgRoleCan("member,admin", "experiment", a), ALL_ACTIONS);
    expectExactly((a) => orgRoleCan("member,bogus", "experiment", a), ["read"]);
  });
});

describe("the grant and organization matrices disagree only about the middle tier", () => {
  it("splits the middle tier: a grant contributes, an org role does not", () => {
    expect(grantRoleCan("viewer", "experiment", "contribute")).toBe(true);
    expect(orgRoleCan("member", "experiment", "contribute")).toBe(false);
    // ...and agree on everything else about that tier.
    expect(grantRoleCan("viewer", "experiment", "read")).toBe(true);
    expect(orgRoleCan("member", "experiment", "read")).toBe(true);
    for (const action of ["update", "share", "manage"] as const) {
      expect(grantRoleCan("viewer", "experiment", action)).toBe(false);
      expect(orgRoleCan("member", "experiment", action)).toBe(false);
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

  it("recognizes only the write vocabulary plus the mixed-version read alias", () => {
    const recognized = ["owner", "admin", "viewer", "member", "bogus"].filter((role) =>
      grantRoleCan(role, "experiment", "read"),
    );

    expect([...recognized].sort()).toEqual([...GRANT_ROLES, "member"].sort());
  });

  it("does not let writers mint the compatibility 'member' spelling", () => {
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
