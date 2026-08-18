import { faker } from "@faker-js/faker";

import { and, deviceGroups, eq, resourceGrants } from "@repo/database";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { CreateIotDeviceGroupUseCase } from "../create-iot-device-group/create-iot-device-group";
import { DeleteIotDeviceGroupUseCase } from "./delete-iot-device-group";

describe("DeleteIotDeviceGroupUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: DeleteIotDeviceGroupUseCase;
  let createGroup: CreateIotDeviceGroupUseCase;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Group Deleter" });
    useCase = testApp.module.get(DeleteIotDeviceGroupUseCase);
    createGroup = testApp.module.get(CreateIotDeviceGroupUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("deletes the group and its resource grants", async () => {
    const created = await createGroup.execute({ name: "Doomed" }, userId);
    assertSuccess(created);
    const groupId = created.value.id;
    const grantee = await testApp.createTestUser({ name: "Grantee" });
    await testApp.addResourceGrant({
      resourceType: "device_group",
      resourceId: groupId,
      granteeType: "user",
      granteeId: grantee,
      role: "viewer",
    });

    const result = await useCase.execute(groupId, userId);

    assertSuccess(result);
    const rows = await testApp.database
      .select()
      .from(deviceGroups)
      .where(eq(deviceGroups.id, groupId));
    expect(rows).toHaveLength(0);
    const grants = await testApp.database
      .select()
      .from(resourceGrants)
      .where(
        and(
          eq(resourceGrants.resourceType, "device_group"),
          eq(resourceGrants.resourceId, groupId),
        ),
      );
    expect(grants).toHaveLength(0);
  });

  it("returns 404 for a random uuid", async () => {
    const result = await useCase.execute(faker.string.uuid(), userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });
});
