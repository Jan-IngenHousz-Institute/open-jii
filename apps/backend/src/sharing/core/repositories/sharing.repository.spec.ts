import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";
import { deviceGroups, eq, macros } from "@repo/database";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { SharingRepository } from "./sharing.repository";

describe("SharingRepository", () => {
  const testApp = TestHarness.App;
  let repository: SharingRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(SharingRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("listAdminIds", () => {
    const builders: Record<
      "macro" | "device_group",
      (organizationId: string, createdBy: string) => Promise<string>
    > = {
      macro: async (organizationId, createdBy) =>
        (await testApp.createMacro({ name: "Admins macro", createdBy, organizationId })).id,
      device_group: async (organizationId, createdBy) => {
        const [group] = await testApp.database
          .insert(deviceGroups)
          .values({ name: "Admins group", organizationId, createdBy })
          .returning();
        return group.id;
      },
    };

    async function grant(
      resourceType: SharingResourceType,
      resourceId: string,
      granteeType: "user" | "team" | "organization",
      granteeId: string,
      role: "admin" | "viewer",
    ) {
      await testApp.addResourceGrant({ resourceType, resourceId, granteeType, granteeId, role });
    }

    it.each(["macro", "device_group"] as const)(
      "returns the %s's admin grant holder and the owning org's owner, and nobody else",
      async (resourceType) => {
        const org = await testApp.createOrganization();
        const orgOwner = await testApp.createTestUser({ name: "Org Owner" });
        await testApp.addOrganizationMember(org, orgOwner, "owner");
        const orgAdmin = await testApp.createTestUser({ name: "Org Admin" });
        await testApp.addOrganizationMember(org, orgAdmin, "admin");

        const resourceId = await builders[resourceType](org, orgOwner);

        const grantAdmin = await testApp.createTestUser({ name: "Grant Admin" });
        await grant(resourceType, resourceId, "user", grantAdmin, "admin");
        // The owner holding a grant too must not make them appear twice.
        await grant(resourceType, resourceId, "user", orgOwner, "admin");

        const viewer = await testApp.createTestUser({ name: "Viewer" });
        await grant(resourceType, resourceId, "user", viewer, "viewer");

        const team = await testApp.createTeam(org);
        const teamMember = await testApp.createTestUser({ name: "Team Member" });
        await testApp.addTeamMember(team, teamMember);
        await grant(resourceType, resourceId, "team", team, "admin");

        const otherOrg = await testApp.createOrganization();
        const otherOrgMember = await testApp.createTestUser({ name: "Other Org Member" });
        await testApp.addOrganizationMember(otherOrg, otherOrgMember, "owner");
        await grant(resourceType, resourceId, "organization", otherOrg, "admin");

        const deactivated = await testApp.createTestUser({
          name: "Deactivated Admin",
          activated: false,
        });
        await grant(resourceType, resourceId, "user", deactivated, "admin");

        const deleted = await testApp.createTestUser({
          name: "Deleted Admin",
          deletedAt: new Date(),
        });
        await grant(resourceType, resourceId, "user", deleted, "admin");

        const result = await repository.listAdminIds(resourceType, resourceId);

        assertSuccess(result);
        expect([...result.value].sort()).toEqual([grantAdmin, orgOwner].sort());
      },
    );

    it.each(["macro", "device_group"] as const)(
      "returns nobody for an ungranted %s whose personal-workspace owner has closed their account",
      async (resourceType) => {
        const gone = await testApp.createTestUser({ name: "Gone", deletedAt: new Date() });
        const workspace = await testApp.personalOrganizationId(gone);
        const resourceId = await builders[resourceType](workspace, gone);

        const result = await repository.listAdminIds(resourceType, resourceId);

        assertSuccess(result);
        expect(result.value).toEqual([]);
      },
    );
  });

  describe("listMemberIds", () => {
    const builders: Record<
      "macro" | "device_group",
      (organizationId: string, createdBy: string) => Promise<string>
    > = {
      macro: async (organizationId, createdBy) =>
        (await testApp.createMacro({ name: "Members macro", createdBy, organizationId })).id,
      device_group: async (organizationId, createdBy) => {
        const [group] = await testApp.database
          .insert(deviceGroups)
          .values({ name: "Members group", organizationId, createdBy })
          .returning();
        return group.id;
      },
    };

    async function grant(
      resourceType: SharingResourceType,
      resourceId: string,
      granteeType: "user" | "team" | "organization",
      granteeId: string,
      role: "admin" | "viewer",
    ) {
      await testApp.addResourceGrant({ resourceType, resourceId, granteeType, granteeId, role });
    }

    it.each(["macro", "device_group"] as const)(
      "returns the %s's admin and viewer grant holders and the owning org's living owner, each once",
      async (resourceType) => {
        const org = await testApp.createOrganization();
        const orgOwner = await testApp.createTestUser({ name: "Org Owner" });
        await testApp.addOrganizationMember(org, orgOwner, "owner");
        const orgAdmin = await testApp.createTestUser({ name: "Org Admin" });
        await testApp.addOrganizationMember(org, orgAdmin, "admin");
        const deletedOwner = await testApp.createTestUser({
          name: "Deleted Owner",
          deletedAt: new Date(),
        });
        await testApp.addOrganizationMember(org, deletedOwner, "owner");

        const resourceId = await builders[resourceType](org, orgOwner);

        const grantAdmin = await testApp.createTestUser({ name: "Grant Admin" });
        await grant(resourceType, resourceId, "user", grantAdmin, "admin");
        const viewer = await testApp.createTestUser({ name: "Viewer" });
        await grant(resourceType, resourceId, "user", viewer, "viewer");
        await grant(resourceType, resourceId, "user", orgOwner, "viewer");

        const team = await testApp.createTeam(org);
        const teamMember = await testApp.createTestUser({ name: "Team Member" });
        await testApp.addTeamMember(team, teamMember);
        await grant(resourceType, resourceId, "team", team, "admin");

        const otherOrg = await testApp.createOrganization();
        const otherOrgMember = await testApp.createTestUser({ name: "Other Org Member" });
        await testApp.addOrganizationMember(otherOrg, otherOrgMember, "owner");
        await grant(resourceType, resourceId, "organization", otherOrg, "viewer");

        const deactivatedViewer = await testApp.createTestUser({
          name: "Deactivated Viewer",
          activated: false,
        });
        await grant(resourceType, resourceId, "user", deactivatedViewer, "viewer");

        const result = await repository.listMemberIds(resourceType, resourceId);

        assertSuccess(result);
        expect(result.value).toHaveLength(3);
        expect([...result.value].sort()).toEqual([grantAdmin, viewer, orgOwner].sort());
      },
    );

    it.each(["macro", "device_group"] as const)(
      "returns the creator of an ungranted %s in their personal workspace",
      async (resourceType) => {
        const creator = await testApp.createTestUser({ name: "Creator" });
        const workspace = await testApp.personalOrganizationId(creator);
        const resourceId = await builders[resourceType](workspace, creator);

        const result = await repository.listMemberIds(resourceType, resourceId);

        assertSuccess(result);
        expect(result.value).toEqual([creator]);
      },
    );

    it("reads the owners of the organization passed in, not the one the resource now names", async () => {
      const losingOrg = await testApp.createOrganization();
      const losingOwner = await testApp.createTestUser({ name: "Losing Owner" });
      await testApp.addOrganizationMember(losingOrg, losingOwner, "owner");
      const receivingOrg = await testApp.createOrganization();
      const receivingOwner = await testApp.createTestUser({ name: "Receiving Owner" });
      await testApp.addOrganizationMember(receivingOrg, receivingOwner, "owner");

      const macroId = await builders.macro(losingOrg, losingOwner);
      const viewer = await testApp.createTestUser({ name: "Viewer" });
      await grant("macro", macroId, "user", viewer, "viewer");
      await testApp.database
        .update(macros)
        .set({ organizationId: receivingOrg })
        .where(eq(macros.id, macroId));

      const passed = await repository.listMemberIds("macro", macroId, losingOrg);
      const none = await repository.listMemberIds("macro", macroId, null);

      assertSuccess(passed);
      expect([...passed.value].sort()).toEqual([losingOwner, viewer].sort());
      assertSuccess(none);
      expect(none.value).toEqual([viewer]);
    });
  });

  describe("findOrganizationName", () => {
    it("names an existing organization", async () => {
      const org = await testApp.createOrganization("Field Station North");

      const result = await repository.findOrganizationName(org);

      assertSuccess(result);
      expect(result.value).toBe("Field Station North");
    });

    it("returns null for an unknown id", async () => {
      const result = await repository.findOrganizationName(crypto.randomUUID());

      assertSuccess(result);
      expect(result.value).toBeNull();
    });
  });
});
