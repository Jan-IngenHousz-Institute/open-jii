import { eq, sensors, users } from "@repo/database";

import { TestHarness } from "../test/test-harness";
import { AuthorizationService } from "./authorization.service";

describe("AuthorizationService", () => {
  const testApp = TestHarness.App;
  let service: AuthorizationService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    service = testApp.module.get(AuthorizationService);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function experimentInOrg(opts: { ownerId: string; visibility?: "private" | "public" }) {
    const org = await testApp.createOrganization();
    const { experiment } = await testApp.createExperiment({
      name: `Exp ${crypto.randomUUID().slice(0, 8)}`,
      userId: opts.ownerId,
      visibility: opts.visibility ?? "private",
      organizationId: org.id,
    });
    return { org, experiment };
  }

  it("allows a platform admin any action (resolution short-circuits)", async () => {
    const adminId = await testApp.createTestUser();
    await testApp.database.update(users).set({ role: "admin" }).where(eq(users.id, adminId));
    const owner = await testApp.createTestUser();
    const { experiment } = await experimentInOrg({ ownerId: owner });

    const decision = await service.can(adminId, {
      resourceType: "experiment",
      resourceId: experiment.id,
      action: "delete",
    });
    expect(decision).toMatchObject({ allow: true, reason: "platform-admin" });
  });

  it("returns not-found for a missing resource", async () => {
    const userId = await testApp.createTestUser();
    const decision = await service.can(userId, {
      resourceType: "experiment",
      resourceId: crypto.randomUUID(),
      action: "read",
    });
    expect(decision).toEqual({ allow: false, reason: "not-found" });
  });

  it("allows an org admin to update via owning-org role", async () => {
    const ownerId = await testApp.createTestUser();
    const { org, experiment } = await experimentInOrg({ ownerId });
    const orgAdmin = await testApp.createTestUser();
    await testApp.addOrgMember(org.id, orgAdmin, "admin");

    const decision = await service.can(orgAdmin, {
      resourceType: "experiment",
      resourceId: experiment.id,
      action: "update",
    });
    expect(decision).toMatchObject({ allow: true, reason: "org-role", role: "admin" });
  });

  it("lets an org member read but not update", async () => {
    const ownerId = await testApp.createTestUser();
    const { org, experiment } = await experimentInOrg({ ownerId });
    const member = await testApp.createTestUser();
    await testApp.addOrgMember(org.id, member, "member");

    expect(await service.can(member, base(experiment.id, "read"))).toMatchObject({
      allow: true,
      reason: "org-role",
    });
    expect(await service.can(member, base(experiment.id, "update"))).toMatchObject({
      allow: false,
      reason: "forbidden",
    });
  });

  it("honors a direct per-user resource grant (cross-org sharing)", async () => {
    const ownerId = await testApp.createTestUser();
    const { experiment } = await experimentInOrg({ ownerId });
    const outsider = await testApp.createTestUser();

    expect(await service.can(outsider, base(experiment.id, "update"))).toMatchObject({
      allow: false,
      reason: "forbidden",
    });

    await testApp.grant({
      resourceType: "experiment",
      resourceId: experiment.id,
      granteeType: "user",
      granteeId: outsider,
      role: "admin",
    });

    expect(await service.can(outsider, base(experiment.id, "update"))).toMatchObject({
      allow: true,
      reason: "resource-grant:user",
      role: "admin",
    });
  });

  it("honors a grant to an organization the user belongs to", async () => {
    const ownerId = await testApp.createTestUser();
    const { experiment } = await experimentInOrg({ ownerId });
    const otherOrg = await testApp.createOrganization();
    const collaborator = await testApp.createTestUser();
    await testApp.addOrgMember(otherOrg.id, collaborator, "member");

    await testApp.grant({
      resourceType: "experiment",
      resourceId: experiment.id,
      granteeType: "organization",
      granteeId: otherOrg.id,
      role: "member",
    });

    expect(await service.can(collaborator, base(experiment.id, "read"))).toMatchObject({
      allow: true,
      reason: "resource-grant:org",
    });
    expect(await service.can(collaborator, base(experiment.id, "delete"))).toMatchObject({
      allow: false,
      reason: "forbidden",
    });
  });

  it("allows anyone to read a public resource but not mutate it", async () => {
    const ownerId = await testApp.createTestUser();
    const { experiment } = await experimentInOrg({ ownerId, visibility: "public" });
    const stranger = await testApp.createTestUser();

    expect(await service.can(stranger, base(experiment.id, "read"))).toMatchObject({
      allow: true,
      reason: "public",
    });
    expect(await service.can(stranger, base(experiment.id, "update"))).toMatchObject({
      allow: false,
      reason: "forbidden",
    });
  });

  it("denies a non-member on a private resource", async () => {
    const ownerId = await testApp.createTestUser();
    const { experiment } = await experimentInOrg({ ownerId, visibility: "private" });
    const stranger = await testApp.createTestUser();

    expect(await service.can(stranger, base(experiment.id, "read"))).toEqual({
      allow: false,
      reason: "forbidden",
    });
  });

  it("returns not-found for a missing device", async () => {
    const userId = await testApp.createTestUser();
    const decision = await service.can(userId, {
      resourceType: "device",
      resourceId: crypto.randomUUID(),
      action: "read",
    });
    expect(decision).toEqual({ allow: false, reason: "not-found" });
  });

  it("authorizes a device (sensor) via owning-org role", async () => {
    const ownerId = await testApp.createTestUser();
    const org = await testApp.createOrganization();
    await testApp.addOrgMember(org.id, ownerId, "member");
    const [sensor] = await testApp.database
      .insert(sensors)
      .values({
        serialNumber: `S-${crypto.randomUUID().slice(0, 8)}`,
        name: "MultispeQ",
        family: "multispeq",
        organizationId: org.id,
        visibility: "private",
      })
      .returning();

    expect(
      await service.can(ownerId, { resourceType: "device", resourceId: sensor.id, action: "read" }),
    ).toMatchObject({ allow: true, reason: "org-role" });

    const stranger = await testApp.createTestUser();
    expect(
      await service.can(stranger, {
        resourceType: "device",
        resourceId: sensor.id,
        action: "read",
      }),
    ).toMatchObject({ allow: false, reason: "forbidden" });
  });

  it("authorizes a macro via owning-org role (non-experiment resource type)", async () => {
    const ownerId = await testApp.createTestUser();
    const org = await testApp.createOrganization();
    await testApp.addOrgMember(org.id, ownerId, "admin");
    const macro = await testApp.createMacro({
      name: `Macro ${crypto.randomUUID().slice(0, 8)}`,
      createdBy: ownerId,
      organizationId: org.id,
      visibility: "private",
    });

    expect(
      await service.can(ownerId, { resourceType: "macro", resourceId: macro.id, action: "update" }),
    ).toMatchObject({ allow: true, reason: "org-role" });

    const stranger = await testApp.createTestUser();
    expect(
      await service.can(stranger, {
        resourceType: "macro",
        resourceId: macro.id,
        action: "update",
      }),
    ).toMatchObject({ allow: false, reason: "forbidden" });
  });

  it("treats a public macro as world-readable", async () => {
    const ownerId = await testApp.createTestUser();
    const org = await testApp.createOrganization();
    const macro = await testApp.createMacro({
      name: `Macro ${crypto.randomUUID().slice(0, 8)}`,
      createdBy: ownerId,
      organizationId: org.id,
      visibility: "public",
    });
    const stranger = await testApp.createTestUser();

    expect(
      await service.can(stranger, { resourceType: "macro", resourceId: macro.id, action: "read" }),
    ).toMatchObject({ allow: true, reason: "public" });
    expect(
      await service.can(stranger, {
        resourceType: "macro",
        resourceId: macro.id,
        action: "delete",
      }),
    ).toMatchObject({ allow: false, reason: "forbidden" });
  });
});

function base(resourceId: string, action: "read" | "update" | "delete" | "share" | "manage") {
  return { resourceType: "experiment" as const, resourceId, action };
}
