import { and, eq, resourceGrants } from "@repo/database";

import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { CreateIotDeviceGroupUseCase } from "./create-iot-device-group";

describe("CreateIotDeviceGroupUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: CreateIotDeviceGroupUseCase;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Group Creator" });
    useCase = testApp.module.get(CreateIotDeviceGroupUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const grantsFor = (groupId: string) =>
    testApp.database
      .select()
      .from(resourceGrants)
      .where(
        and(
          eq(resourceGrants.resourceType, "device_group"),
          eq(resourceGrants.resourceId, groupId),
        ),
      );

  it("creates a private group owned by the caller in their personal org", async () => {
    const result = await useCase.execute({ name: "Field batch", description: "Plot A" }, userId);

    assertSuccess(result);
    expect(result.value.name).toBe("Field batch");
    expect(result.value.description).toBe("Plot A");
    expect(result.value.createdBy).toBe(userId);
    expect(result.value.visibility).toBe("private");
    expect(result.value.organizationId).toBe(await testApp.personalOrganizationId(userId));

    // Owning the personal org already confers full control, so no grant is seeded.
    expect(await grantsFor(result.value.id)).toHaveLength(0);
  });

  it("seeds a creator admin grant when creating into an org the caller only belongs to as member", async () => {
    const orgOwner = await testApp.createTestUser({ name: "Org Owner" });
    const orgId = await testApp.createOrganization();
    await testApp.addOrganizationMember(orgId, orgOwner, "owner");
    await testApp.addOrganizationMember(orgId, userId, "member");

    const result = await useCase.execute({ name: "Org batch", organizationId: orgId }, userId);

    assertSuccess(result);
    expect(result.value.organizationId).toBe(orgId);

    const grants = await grantsFor(result.value.id);
    expect(grants).toHaveLength(1);
    expect(grants[0].granteeType).toBe("user");
    expect(grants[0].granteeId).toBe(userId);
    expect(grants[0].role).toBe("admin");
  });
});
