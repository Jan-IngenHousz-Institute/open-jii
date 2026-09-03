import { faker } from "@faker-js/faker";

import { AppError, assertFailure, assertSuccess, failure } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { IotDeviceGroupRepository } from "../../../core/repositories/iot-device-group.repository";
import { CreateIotDeviceGroupUseCase } from "../create-iot-device-group/create-iot-device-group";
import { AddIotDeviceGroupMembersUseCase } from "./add-iot-device-group-members";

describe("AddIotDeviceGroupMembersUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: AddIotDeviceGroupMembersUseCase;
  let createGroup: CreateIotDeviceGroupUseCase;
  let userId: string;
  let groupId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Roster Manager" });
    useCase = testApp.module.get(AddIotDeviceGroupMembersUseCase);
    createGroup = testApp.module.get(CreateIotDeviceGroupUseCase);

    const created = await createGroup.execute({ name: "Batch" }, userId);
    assertSuccess(created);
    groupId = created.value.id;
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("adds devices and returns the roster", async () => {
    const first = await testApp.createIotDevice({ createdBy: userId });
    const second = await testApp.createIotDevice({ createdBy: userId });

    const result = await useCase.execute(groupId, [first.id, second.id], userId);

    assertSuccess(result);
    expect(result.value.map((member) => member.deviceId).sort()).toEqual(
      [first.id, second.id].sort(),
    );
  });

  it("returns 404 when one of the devices does not exist", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });

    const result = await useCase.execute(groupId, [device.id, faker.string.uuid()], userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("returns forbidden when the caller cannot manage one of the devices", async () => {
    const otherUser = await testApp.createTestUser({ name: "Other Owner" });
    const mine = await testApp.createIotDevice({ createdBy: userId });
    const theirs = await testApp.createIotDevice({ createdBy: otherUser });

    const result = await useCase.execute(groupId, [mine.id, theirs.id], userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
  });

  it("treats re-adding an existing member as a no-op", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    await useCase.execute(groupId, [device.id], userId);

    const result = await useCase.execute(groupId, [device.id], userId);

    assertSuccess(result);
    expect(result.value).toHaveLength(1);
  });

  it("propagates an existence-check failure", async () => {
    const repo = testApp.module.get(IotDeviceGroupRepository);
    vi.spyOn(repo, "existingDeviceIds").mockResolvedValue(failure(AppError.internal("boom")));

    const result = await useCase.execute(faker.string.uuid(), [faker.string.uuid()], userId);

    assertFailure(result);
  });

  it("propagates an insert failure", async () => {
    const repo = testApp.module.get(IotDeviceGroupRepository);
    const device = await testApp.createIotDevice({ createdBy: userId });
    vi.spyOn(repo, "addMembers").mockResolvedValue(failure(AppError.internal("boom")));

    const result = await useCase.execute(faker.string.uuid(), [device.id], userId);

    assertFailure(result);
  });
});
