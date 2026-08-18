import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { IotDeviceGroupRepository } from "../../../core/repositories/iot-device-group.repository";
import { CreateIotDeviceGroupUseCase } from "../create-iot-device-group/create-iot-device-group";
import { ListIotDeviceGroupsUseCase } from "./list-iot-device-groups";

describe("ListIotDeviceGroupsUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: ListIotDeviceGroupsUseCase;
  let createGroup: CreateIotDeviceGroupUseCase;
  let groupRepository: IotDeviceGroupRepository;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Group Lister" });
    useCase = testApp.module.get(ListIotDeviceGroupsUseCase);
    createGroup = testApp.module.get(CreateIotDeviceGroupUseCase);
    groupRepository = testApp.module.get(IotDeviceGroupRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("lists the caller's groups with member counts", async () => {
    const populated = await createGroup.execute({ name: "Populated" }, userId);
    assertSuccess(populated);
    const empty = await createGroup.execute({ name: "Empty" }, userId);
    assertSuccess(empty);
    const device = await testApp.createIotDevice({ createdBy: userId });
    await groupRepository.addMembers(populated.value.id, [device.id], userId);

    const result = await useCase.execute(userId);

    assertSuccess(result);
    expect(result.value).toHaveLength(2);
    const populatedRow = result.value.find((group) => group.id === populated.value.id);
    const emptyRow = result.value.find((group) => group.id === empty.value.id);
    expect(populatedRow?.memberCount).toBe(1);
    expect(emptyRow?.memberCount).toBe(0);
  });

  it("excludes another user's private group", async () => {
    const otherUser = await testApp.createTestUser({ name: "Other Owner" });
    const foreign = await createGroup.execute({ name: "Foreign" }, otherUser);
    assertSuccess(foreign);

    const result = await useCase.execute(userId);

    assertSuccess(result);
    expect(result.value.map((group) => group.id)).not.toContain(foreign.value.id);
  });
});
