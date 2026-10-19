import { faker } from "@faker-js/faker";

import { and, deviceGroups, eq, resourceGrants } from "@repo/database";

import { AppError, assertFailure, assertSuccess, failure } from "../../../../common/utils/fp-utils";
import {
  audienceDeliveries,
  audienceNotifications,
  grantResourceAudience,
  heardByAllButTheActor,
  seedResourceAudience,
} from "../../../../test/resource-audience";
import { TestHarness } from "../../../../test/test-harness";
import { IotDeviceGroupRepository } from "../../../core/repositories/iot-device-group.repository";
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

  it("propagates a repository failure", async () => {
    const repo = testApp.module.get(IotDeviceGroupRepository);
    vi.spyOn(repo, "delete").mockResolvedValue(failure(AppError.internal("boom")));

    const result = await useCase.execute(faker.string.uuid(), userId);

    assertFailure(result);
  });

  it("tells the grantees and the owner, not the deleter, and queues their emails", async () => {
    const audience = await seedResourceAudience(testApp);
    const [group] = await testApp.database
      .insert(deviceGroups)
      .values({
        name: "North Field Sensors",
        organizationId: audience.organizationId,
        createdBy: audience.owner,
      })
      .returning();
    const resourceId = group.id;
    await grantResourceAudience(testApp, audience, "device_group", resourceId);

    assertSuccess(await useCase.execute(resourceId, audience.actor));

    expect(await audienceNotifications(testApp, audience)).toEqual(
      heardByAllButTheActor(audience, (recipientId) => ({
        type: "resource_deleted",
        recipientId,
        actorId: audience.actor,
        resourceType: "device_group",
        resourceId,
        params: { resourceName: "North Field Sensors" },
      })),
    );
    expect(await audienceDeliveries(testApp, audience)).toEqual(
      heardByAllButTheActor(audience, () => ({ type: "resource_deleted", status: "pending" })),
    );
  });
});
