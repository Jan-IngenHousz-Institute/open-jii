import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";
import { deviceGroups } from "@repo/database";

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
});
