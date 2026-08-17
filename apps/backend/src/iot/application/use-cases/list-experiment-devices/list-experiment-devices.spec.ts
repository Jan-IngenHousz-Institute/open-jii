import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ExperimentDeviceRepository } from "../../../core/repositories/experiment-device.repository";
import { ListExperimentDevicesUseCase } from "./list-experiment-devices";

describe("ListExperimentDevicesUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: ListExperimentDevicesUseCase;
  let repository: ExperimentDeviceRepository;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    useCase = testApp.module.get(ListExperimentDevicesUseCase);
    repository = testApp.module.get(ExperimentDeviceRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns not found for an unknown experiment", async () => {
    const result = await useCase.execute("11111111-1111-4111-8111-111111111111", userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("lists bound devices with their metadata for a member", async () => {
    const { experiment } = await testApp.createExperiment({ name: "E", userId });
    const device = await testApp.createIotDevice({
      createdBy: userId,
      name: "Field Gateway",
      status: "active",
    });
    await repository.addExperiments(device.id, [experiment.id], userId);

    const result = await useCase.execute(experiment.id, userId);

    assertSuccess(result);
    expect(result.value).toHaveLength(1);
    expect(result.value[0].device).toMatchObject({
      id: device.id,
      thingName: device.thingName,
      serialNumber: device.serialNumber,
      name: "Field Gateway",
      deviceType: device.deviceType,
      status: "active",
    });
    expect(result.value[0].addedBy).toBe(userId);
  });

  it("allows an org-role reader who is not a member", async () => {
    const { experiment } = await testApp.createExperiment({ name: "E", userId });
    const device = await testApp.createIotDevice({ createdBy: userId });
    await repository.addExperiments(device.id, [experiment.id], userId);

    const orgReader = await testApp.createTestUser({});
    await testApp.addOrganizationMember(experiment.organizationId, orgReader, "member");

    const result = await useCase.execute(experiment.id, orgReader);

    assertSuccess(result);
    expect(result.value).toHaveLength(1);
  });

  it("rejects the public-read tier", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Public",
      userId,
      visibility: "public",
    });
    const stranger = await testApp.createTestUser({});

    const result = await useCase.execute(experiment.id, stranger);

    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
  });

  it("rejects a stranger on a private experiment", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Private", userId });
    const stranger = await testApp.createTestUser({});

    const result = await useCase.execute(experiment.id, stranger);

    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
  });
});
