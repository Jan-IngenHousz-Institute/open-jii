import { faker } from "@faker-js/faker";

import { AppError, assertFailure, assertSuccess, failure } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { IotDeviceGroupRepository } from "../../../core/repositories/iot-device-group.repository";
import { CreateIotDeviceGroupUseCase } from "../create-iot-device-group/create-iot-device-group";
import { GetIotDeviceGroupUseCase } from "./get-iot-device-group";

describe("GetIotDeviceGroupUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetIotDeviceGroupUseCase;
  let createGroup: CreateIotDeviceGroupUseCase;
  let groupRepository: IotDeviceGroupRepository;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Group Reader" });
    useCase = testApp.module.get(GetIotDeviceGroupUseCase);
    createGroup = testApp.module.get(CreateIotDeviceGroupUseCase);
    groupRepository = testApp.module.get(IotDeviceGroupRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns the group with its member count", async () => {
    const created = await createGroup.execute({ name: "Roof sensors" }, userId);
    assertSuccess(created);
    const device = await testApp.createIotDevice({ createdBy: userId });
    await groupRepository.addMembers(created.value.id, [device.id], userId);

    const result = await useCase.execute(created.value.id);

    assertSuccess(result);
    expect(result.value.id).toBe(created.value.id);
    expect(result.value.name).toBe("Roof sensors");
    expect(result.value.memberCount).toBe(1);
  });

  it("returns 404 for a random uuid", async () => {
    const result = await useCase.execute(faker.string.uuid());

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("propagates a repository failure", async () => {
    vi.spyOn(groupRepository, "findById").mockResolvedValue(failure(AppError.internal("boom")));

    const result = await useCase.execute(faker.string.uuid());

    assertFailure(result);
  });
});
