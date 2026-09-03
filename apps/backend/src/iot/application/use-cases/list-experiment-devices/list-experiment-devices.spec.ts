import { AwsAdapter } from "../../../../common/modules/aws/aws.adapter";
import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ExperimentDeviceRepository } from "../../../core/repositories/experiment-device.repository";
import { ListExperimentDevicesUseCase } from "./list-experiment-devices";

const NOW = new Date("2026-09-03T12:00:00.000Z");

describe("ListExperimentDevicesUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: ListExperimentDevicesUseCase;
  let repository: ExperimentDeviceRepository;
  let awsAdapter: AwsAdapter;
  let databricksAdapter: DatabricksAdapter;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    useCase = testApp.module.get(ListExperimentDevicesUseCase);
    repository = testApp.module.get(ExperimentDeviceRepository);
    awsAdapter = testApp.module.get(AwsAdapter);
    databricksAdapter = testApp.module.get(DatabricksAdapter);
    // Quiet warehouse and fleet index unless a test says otherwise.
    vi.spyOn(awsAdapter, "searchThingsConnectivity").mockResolvedValue(success(new Map()));
    vi.spyOn(databricksAdapter, "getExperimentPublishers").mockResolvedValue(success([]));
    vi.spyOn(databricksAdapter, "getDevicesLastActivity").mockResolvedValue(success(new Map()));
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it("lists bound devices with their binding for a member", async () => {
    const { experiment } = await testApp.createExperiment({ name: "E", userId });
    const device = await testApp.createIotDevice({
      createdBy: userId,
      name: "Field Gateway",
      status: "active",
    });
    await repository.addExperiments(device.id, [experiment.id], userId);

    const result = await useCase.execute(experiment.id, userId, NOW);

    assertSuccess(result);
    expect(result.value.devices).toHaveLength(1);
    expect(result.value.devices[0]).toMatchObject({
      device: {
        id: device.id,
        thingName: device.thingName,
        serialNumber: device.serialNumber,
        name: "Field Gateway",
        deviceType: device.deviceType,
        status: "active",
      },
      clientId: device.thingName,
      binding: { addedBy: userId },
      connectivity: null,
      lastDataAt: null,
      recentData: null,
      canView: true,
    });
    expect(result.value.window).toEqual({
      from: "2026-08-04T12:00:00.000Z",
      to: "2026-09-03T12:00:00.000Z",
    });
    expect(result.value.pipelineUnavailable).toBe(false);
  });

  it("joins fleet-index and warehouse facts onto a bound device", async () => {
    const { experiment } = await testApp.createExperiment({ name: "E", userId });
    const device = await testApp.createIotDevice({ createdBy: userId });
    await repository.addExperiments(device.id, [experiment.id], userId);

    vi.spyOn(awsAdapter, "searchThingsConnectivity").mockResolvedValue(
      success(
        new Map([
          [device.thingName, { thingName: device.thingName, connected: true, lastSeenAt: null }],
        ]),
      ),
    );
    vi.spyOn(databricksAdapter, "getDevicesLastActivity").mockResolvedValue(
      success(new Map([[device.thingName, "2026-09-03T10:00:00.000Z"]])),
    );
    const publishers = vi
      .spyOn(databricksAdapter, "getExperimentPublishers")
      .mockResolvedValue(
        success([
          { clientId: device.thingName, count: 42, lastDataAt: "2026-09-03T09:00:00.000Z" },
        ]),
      );

    const result = await useCase.execute(experiment.id, userId, NOW);

    assertSuccess(result);
    expect(result.value.devices[0]).toMatchObject({
      connectivity: { connected: true, lastSeenAt: null },
      lastDataAt: "2026-09-03T10:00:00.000Z",
      recentData: { measurementCount: 42, lastDataAt: "2026-09-03T09:00:00.000Z" },
    });
    expect(publishers).toHaveBeenCalledWith(
      experiment.id,
      "2026-08-04T12:00:00.000Z",
      "2026-09-03T12:00:00.000Z",
      expect.any(Number),
    );
  });

  it("adds a registered device that published without a binding, after the bound ones", async () => {
    const { experiment } = await testApp.createExperiment({ name: "E", userId });
    const bound = await testApp.createIotDevice({ createdBy: userId, name: "Bound" });
    await repository.addExperiments(bound.id, [experiment.id], userId);
    const stranger = await testApp.createTestUser({});
    const phone = await testApp.createIotDevice({ createdBy: stranger, name: "Phone" });

    vi.spyOn(databricksAdapter, "getExperimentPublishers").mockResolvedValue(
      success([
        { clientId: phone.thingName, count: 7, lastDataAt: "2026-09-02T00:00:00.000Z" },
        { clientId: bound.thingName, count: 1, lastDataAt: "2026-08-20T00:00:00.000Z" },
      ]),
    );

    const result = await useCase.execute(experiment.id, userId, NOW);

    assertSuccess(result);
    expect(result.value.devices.map((entry) => entry.device?.id)).toEqual([bound.id, phone.id]);
    expect(result.value.devices[1]).toMatchObject({
      binding: null,
      recentData: { measurementCount: 7 },
      // Someone else's private phone: listed with its facts, not openable.
      canView: false,
    });
  });

  it("keeps a publisher with no registry row as an unregistered entry", async () => {
    const { experiment } = await testApp.createExperiment({ name: "E", userId });
    vi.spyOn(databricksAdapter, "getExperimentPublishers").mockResolvedValue(
      success([{ clientId: "cognito-abc", count: 3, lastDataAt: "2026-09-01T00:00:00.000Z" }]),
    );

    const result = await useCase.execute(experiment.id, userId, NOW);

    assertSuccess(result);
    expect(result.value.devices).toEqual([
      {
        device: null,
        clientId: "cognito-abc",
        binding: null,
        connectivity: null,
        lastDataAt: null,
        recentData: { measurementCount: 3, lastDataAt: "2026-09-01T00:00:00.000Z" },
        canView: false,
      },
    ]);
  });

  it("flags the pipeline unavailable and keeps the roster when the warehouse fails", async () => {
    const { experiment } = await testApp.createExperiment({ name: "E", userId });
    const device = await testApp.createIotDevice({ createdBy: userId });
    await repository.addExperiments(device.id, [experiment.id], userId);
    vi.spyOn(databricksAdapter, "getExperimentPublishers").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );

    const result = await useCase.execute(experiment.id, userId, NOW);

    assertSuccess(result);
    expect(result.value.pipelineUnavailable).toBe(true);
    expect(result.value.devices).toHaveLength(1);
    expect(result.value.devices[0].recentData).toBeNull();
  });

  it("renders connectivity as unknown when the fleet index fails", async () => {
    const { experiment } = await testApp.createExperiment({ name: "E", userId });
    const device = await testApp.createIotDevice({ createdBy: userId });
    await repository.addExperiments(device.id, [experiment.id], userId);
    vi.spyOn(awsAdapter, "searchThingsConnectivity").mockResolvedValue(
      failure(AppError.internal("index building")),
    );

    const result = await useCase.execute(experiment.id, userId, NOW);

    assertSuccess(result);
    expect(result.value.devices[0].connectivity).toBeNull();
    expect(result.value.pipelineUnavailable).toBe(false);
  });

  it("allows an org-role reader who is not a member", async () => {
    const { experiment } = await testApp.createExperiment({ name: "E", userId });
    const device = await testApp.createIotDevice({ createdBy: userId });
    await repository.addExperiments(device.id, [experiment.id], userId);

    const orgReader = await testApp.createTestUser({});
    await testApp.addOrganizationMember(experiment.organizationId, orgReader, "member");

    const result = await useCase.execute(experiment.id, orgReader, NOW);

    assertSuccess(result);
    expect(result.value.devices).toHaveLength(1);
    expect(result.value.devices[0].canView).toBe(true);
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
