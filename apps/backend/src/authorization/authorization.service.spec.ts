import {
  ensurePersonalOrganization,
  grantResource,
  macros,
  organizationMembers,
  organizations,
} from "@repo/database";

import { TestHarness } from "../test/test-harness";
import type { ResourceAction } from "./abilities";
import { AuthorizationService } from "./authorization.service";

/**
 * End-to-end tests for the org-scoped access resolution (can()), against a real
 * DB. Exercises the documented precedence: owning-org role → base permission →
 * per-resource grant (user → team → org) → public+read → deny.
 */
describe("AuthorizationService.can", () => {
  const testApp = TestHarness.App;
  let authz: AuthorizationService;
  let ownerId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    authz = testApp.module.get(AuthorizationService);
    ownerId = await testApp.createTestUser({});
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  /** Insert a macro owned by `organizationId` with the given visibility. */
  async function makeMacro(opts: {
    organizationId: string | null;
    visibility?: "private" | "public";
    createdBy?: string;
  }) {
    const id = crypto.randomUUID();
    const [macro] = await testApp.database
      .insert(macros)
      .values({
        id,
        name: `Macro ${id}`,
        filename: `${id}.py`,
        language: "python",
        code: "cHk=",
        createdBy: opts.createdBy ?? ownerId,
        organizationId: opts.organizationId,
        visibility: opts.visibility ?? "public",
      })
      .returning();
    return macro;
  }

  /** Insert a shared org with a chosen base permission + a plain member. */
  async function makeOrgWithMember(basePermission: "none" | "read" | "admin", memberEmail: string) {
    const [org] = await testApp.database
      .insert(organizations)
      .values({
        name: `Org ${crypto.randomUUID()}`,
        slug: `org-${crypto.randomUUID()}`,
        basePermission,
      })
      .returning();
    const memberId = await testApp.createTestUser({ email: memberEmail });
    await testApp.database
      .insert(organizationMembers)
      .values({ organizationId: org.id, userId: memberId, role: "member" });
    return { orgId: org.id, memberId };
  }

  it("returns not-found for a missing resource", async () => {
    const decision = await authz.can(ownerId, {
      resourceType: "macro",
      resourceId: crypto.randomUUID(),
      action: "read",
    });
    expect(decision).toEqual({ allow: false, reason: "not-found" });
  });

  it("grants an org owner full access to the org's resources", async () => {
    const orgId = await ensurePersonalOrganization(testApp.database, { id: ownerId });
    const macro = await makeMacro({ organizationId: orgId, visibility: "private" });

    for (const action of ["read", "update", "share", "manage"] as ResourceAction[]) {
      const decision = await authz.can(ownerId, {
        resourceType: "macro",
        resourceId: macro.id,
        action,
      });
      expect(decision).toMatchObject({ allow: true, reason: "org-role", role: "owner" });
    }
  });

  it("allows public read to a non-member but denies writes", async () => {
    const orgId = await ensurePersonalOrganization(testApp.database, { id: ownerId });
    const macro = await makeMacro({ organizationId: orgId, visibility: "public" });
    const stranger = await testApp.createTestUser({ email: "stranger@example.com" });

    const read = await authz.can(stranger, {
      resourceType: "macro",
      resourceId: macro.id,
      action: "read",
    });
    expect(read).toMatchObject({ allow: true, reason: "public" });

    const update = await authz.can(stranger, {
      resourceType: "macro",
      resourceId: macro.id,
      action: "update",
    });
    expect(update).toMatchObject({ allow: false, reason: "forbidden" });
  });

  it("applies a 'read' base permission to a plain member (read only)", async () => {
    const { orgId, memberId } = await makeOrgWithMember("read", "member-read@example.com");
    const macro = await makeMacro({ organizationId: orgId, visibility: "private" });

    const read = await authz.can(memberId, {
      resourceType: "macro",
      resourceId: macro.id,
      action: "read",
    });
    expect(read).toMatchObject({ allow: true, reason: "org-base-permission" });

    const update = await authz.can(memberId, {
      resourceType: "macro",
      resourceId: macro.id,
      action: "update",
    });
    expect(update.allow).toBe(false);
  });

  it("gives a plain member nothing under base permission 'none', but a user grant overrides it", async () => {
    const { orgId, memberId } = await makeOrgWithMember("none", "member-none@example.com");
    const macro = await makeMacro({ organizationId: orgId, visibility: "private" });

    // Base permission none → no implicit access.
    const before = await authz.can(memberId, {
      resourceType: "macro",
      resourceId: macro.id,
      action: "read",
    });
    expect(before).toMatchObject({ allow: false, reason: "forbidden" });

    // A direct user grant (admin) raises the member above the base permission.
    await grantResource(testApp.database, {
      resourceType: "macro",
      resourceId: macro.id,
      granteeType: "user",
      granteeId: memberId,
      role: "admin",
    });
    const after = await authz.can(memberId, {
      resourceType: "macro",
      resourceId: macro.id,
      action: "update",
    });
    expect(after).toMatchObject({ allow: true, reason: "resource-grant:user", role: "admin" });
  });

  it("honors an organization grant to a user who is a member of the grantee org", async () => {
    // Resource owned by org A; user is only a member of org B; org B holds a grant.
    const orgAId = await ensurePersonalOrganization(testApp.database, { id: ownerId });
    const macro = await makeMacro({ organizationId: orgAId, visibility: "private" });

    const [orgB] = await testApp.database
      .insert(organizations)
      .values({ name: "Org B", slug: `org-b-${crypto.randomUUID()}`, basePermission: "none" })
      .returning();
    const outsider = await testApp.createTestUser({ email: "org-grant@example.com" });
    await testApp.database
      .insert(organizationMembers)
      .values({ organizationId: orgB.id, userId: outsider, role: "member" });
    await grantResource(testApp.database, {
      resourceType: "macro",
      resourceId: macro.id,
      granteeType: "organization",
      granteeId: orgB.id,
      role: "member",
    });

    const read = await authz.can(outsider, {
      resourceType: "macro",
      resourceId: macro.id,
      action: "read",
    });
    expect(read).toMatchObject({ allow: true, reason: "resource-grant:org", role: "member" });

    // member grant is read-only.
    const update = await authz.can(outsider, {
      resourceType: "macro",
      resourceId: macro.id,
      action: "update",
    });
    expect(update.allow).toBe(false);
  });
});
