import { faker } from "@faker-js/faker";

import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { IotDeviceGroupRepository } from "../../../core/repositories/iot-device-group.repository";
import { CreateIotDeviceGroupUseCase } from "../create-iot-device-group/create-iot-device-group";
import { RemoveIotDeviceGroupMemberUseCase } from "./remove-iot-device-group-member";

describe("RemoveIotDeviceGroupMemberUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: RemoveIotDeviceGroupMemberUseCase;
  let createGroup: CreateIotDeviceGroupUseCase;
  let groupRepository: IotDeviceGroupRepository;
  let userId: string;
  let groupId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Roster Trimmer" });
    useCase = testApp.module.get(RemoveIotDeviceGroupMemberUseCase);
    createGroup = testApp.module.get(CreateIotDeviceGroupUseCase);
    groupRepository = testApp.module.get(IotDeviceGroupRepository);

    const created = await createGroup.execute({ name: "Trimmed" }, userId);
    assertSuccess(created);
    groupId = created.value.id;
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("removes a member from the group", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    await groupRepository.addMembers(groupId, [device.id], userId);

    const result = await useCase.execute(groupId, device.id, userId);

    assertSuccess(result);
    const roster = await groupRepository.listMembers(groupId);
    assertSuccess(roster);
    expect(roster.value).toEqual([]);
  });

  it("succeeds silently when removing a non-member", async () => {
    const result = await useCase.execute(groupId, faker.string.uuid(), userId);

    assertSuccess(result);
  });
});
