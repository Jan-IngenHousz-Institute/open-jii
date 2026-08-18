import { and, deviceGroupMembers, eq } from "@repo/database";

import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { IotDeviceGroupRepository } from "../../../core/repositories/iot-device-group.repository";
import { CreateIotDeviceGroupUseCase } from "../create-iot-device-group/create-iot-device-group";
import { ListIotDeviceGroupMembersUseCase } from "./list-iot-device-group-members";

describe("ListIotDeviceGroupMembersUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: ListIotDeviceGroupMembersUseCase;
  let createGroup: CreateIotDeviceGroupUseCase;
  let groupRepository: IotDeviceGroupRepository;
  let userId: string;
  let groupId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Roster Reader" });
    useCase = testApp.module.get(ListIotDeviceGroupMembersUseCase);
    createGroup = testApp.module.get(CreateIotDeviceGroupUseCase);
    groupRepository = testApp.module.get(IotDeviceGroupRepository);

    const created = await createGroup.execute({ name: "Roster" }, userId);
    assertSuccess(created);
    groupId = created.value.id;
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns the shallow roster ordered newest-first", async () => {
    const first = await testApp.createIotDevice({ createdBy: userId, name: "First" });
    const second = await testApp.createIotDevice({ createdBy: userId, name: "Second" });
    await groupRepository.addMembers(groupId, [first.id], userId);
    // Backdate the first membership so the ordering assertion is deterministic.
    await testApp.database
      .update(deviceGroupMembers)
      .set({ createdAt: new Date(Date.now() - 60_000) })
      .where(
        and(eq(deviceGroupMembers.groupId, groupId), eq(deviceGroupMembers.deviceId, first.id)),
      );
    await groupRepository.addMembers(groupId, [second.id], userId);

    const result = await useCase.execute(groupId);

    assertSuccess(result);
    expect(result.value.map((member) => member.deviceId)).toEqual([second.id, first.id]);
    expect(result.value[0].name).toBe("Second");
    expect(result.value[0].serialNumber).toBe(second.serialNumber);
    expect(result.value[0].status).toBe("pending");
  });

  it("returns an empty array for a memberless group", async () => {
    const result = await useCase.execute(groupId);

    assertSuccess(result);
    expect(result.value).toEqual([]);
  });
});
