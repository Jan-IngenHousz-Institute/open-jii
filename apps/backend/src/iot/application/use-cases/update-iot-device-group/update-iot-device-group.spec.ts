import { faker } from "@faker-js/faker";

import { AppError, assertFailure, assertSuccess, failure } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { IotDeviceGroupRepository } from "../../../core/repositories/iot-device-group.repository";
import { CreateIotDeviceGroupUseCase } from "../create-iot-device-group/create-iot-device-group";
import { UpdateIotDeviceGroupUseCase } from "./update-iot-device-group";

describe("UpdateIotDeviceGroupUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: UpdateIotDeviceGroupUseCase;
  let createGroup: CreateIotDeviceGroupUseCase;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Group Editor" });
    useCase = testApp.module.get(UpdateIotDeviceGroupUseCase);
    createGroup = testApp.module.get(CreateIotDeviceGroupUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("renames a group and clears its description", async () => {
    const created = await createGroup.execute({ name: "Old name", description: "Old" }, userId);
    assertSuccess(created);

    const result = await useCase.execute(
      created.value.id,
      { name: "New name", description: null },
      userId,
    );

    assertSuccess(result);
    expect(result.value.name).toBe("New name");
    expect(result.value.description).toBeNull();
  });

  it("returns 404 for a random uuid", async () => {
    const result = await useCase.execute(faker.string.uuid(), { name: "Ghost" }, userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("propagates a repository failure", async () => {
    const repo = testApp.module.get(IotDeviceGroupRepository);
    vi.spyOn(repo, "update").mockResolvedValue(failure(AppError.internal("boom")));

    const result = await useCase.execute(faker.string.uuid(), { name: "x" }, userId);

    assertFailure(result);
  });
});
