import { grantRoleCan, orgRoleCan } from "@repo/auth/access";
import type { ResourceAction } from "@repo/auth/access";

/**
 * The capability matrix, pinned action by action.
 *
 * The load-bearing asymmetry is the middle tier: on an experiment, a **grant** of
 * "Can view" carries `contribute` (being handed an experiment is what makes you a
 * contributor to it), while the owning organization's `member` role does not. Both
 * used to resolve through the same read-only role, so this table is what stops them
 * being re-aliased.
 *
 * The second asymmetry is per resource type: `contribute` is only handed out at the
 * read tier where there is data to contribute, which is experiments alone.
 */
const ALL_ACTIONS: ResourceAction[] = ["read", "contribute", "update", "share", "manage"];

/** Actions the role is expected to permit; every other action must be refused. */
function expectExactly(can: (action: ResourceAction) => boolean, allowed: ResourceAction[]): void {
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

  it("treats 'member' as the same tier as 'viewer'", () => {
    expectExactly((a) => grantRoleCan("member", "experiment", a), ["read", "contribute"]);
  });

  it("gives 'admin' every action", () => {
    expectExactly((a) => grantRoleCan("admin", "experiment", a), ALL_ACTIONS);
  });

  it("gives 'owner' every action", () => {
    expectExactly((a) => grantRoleCan("owner", "experiment", a), ALL_ACTIONS);
  });

  it("refuses an unknown role outright", () => {
    expectExactly((a) => grantRoleCan("bogus", "experiment", a), []);
  });

  it("refuses a missing role", () => {
    for (const role of [null, undefined, ""]) {
      expectExactly((a) => grantRoleCan(role, "experiment", a), []);
    }
  });

  it("gives 'viewer' read only on every type that has no data to contribute", () => {
    // A "may add data" signal that answered true where nothing can be added would
    // be a trap for any future surface that reads it generically.
    for (const resourceType of ["protocol", "macro", "workbook", "device"] as const) {
      expectExactly((a) => grantRoleCan("viewer", resourceType, a), ["read"]);
      expectExactly((a) => grantRoleCan("member", resourceType, a), ["read"]);
    }
  });

  it("gives 'admin' every action on every resource type", () => {
    // Full control is uniform: these roles hold every verb, contribute included,
    // whether or not a given type has a surface for it.
    for (const resourceType of ["experiment", "protocol", "macro", "workbook", "device"] as const) {
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
  it("splits 'member': a grant contributes, an org role does not", () => {
    expect(grantRoleCan("member", "experiment", "contribute")).toBe(true);
    expect(orgRoleCan("member", "experiment", "contribute")).toBe(false);
    // ...and agree on everything else about that tier.
    expect(grantRoleCan("member", "experiment", "read")).toBe(true);
    expect(orgRoleCan("member", "experiment", "read")).toBe(true);
    for (const action of ["update", "share", "manage"] as const) {
      expect(grantRoleCan("member", "experiment", action)).toBe(false);
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
