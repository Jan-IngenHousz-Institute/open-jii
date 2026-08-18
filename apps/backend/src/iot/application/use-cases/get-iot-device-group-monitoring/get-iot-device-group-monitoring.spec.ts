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
import { IotDeviceGroupRepository } from "../../../core/repositories/iot-device-group.repository";
import { CreateIotDeviceGroupUseCase } from "../create-iot-device-group/create-iot-device-group";
import { GetIotDeviceGroupMonitoringUseCase } from "./get-iot-device-group-monitoring";

const WINDOW = {
  from: "2026-08-17T00:00:00.000Z",
  to: "2026-08-18T00:00:00.000Z",
  bucket: "hour",
} as const;

describe("GetIotDeviceGroupMonitoringUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetIotDeviceGroupMonitoringUseCase;
  let groupRepository: IotDeviceGroupRepository;
  let awsAdapter: AwsAdapter;
  let databricksAdapter: DatabricksAdapter;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Fleet Owner" });
    useCase = testApp.module.get(GetIotDeviceGroupMonitoringUseCase);
    groupRepository = testApp.module.get(IotDeviceGroupRepository);
    awsAdapter = testApp.module.get(AwsAdapter);
    databricksAdapter = testApp.module.get(DatabricksAdapter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function seedGroupWithDevice() {
    const createGroup = testApp.module.get(CreateIotDeviceGroupUseCase);
    const created = await createGroup.execute({ name: "Fleet" }, userId);
    assertSuccess(created);
    const device = await testApp.createIotDevice({ createdBy: userId, name: "Gateway" });
    const added = await groupRepository.addMembers(created.value.id, [device.id], userId);
    assertSuccess(added);
    return { groupId: created.value.id, device };
  }

  it("joins fleet-index and warehouse facts onto each member by thing name", async () => {
    const { groupId, device } = await seedGroupWithDevice();
    vi.spyOn(awsAdapter, "searchThingsConnectivity").mockResolvedValue(
      success(
        new Map([
          [device.thingName, { thingName: device.thingName, connected: true, lastSeenAt: null }],
        ]),
      ),
    );
    vi.spyOn(databricksAdapter, "getDevicesLastActivity").mockResolvedValue(
      success(new Map([[device.thingName, "2026-08-18T10:00:00.000Z"]])),
    );
    vi.spyOn(databricksAdapter, "getDevicesThroughput").mockResolvedValue(
      success([
        { bucketStart: "2026-08-17T10:00:00.000Z", clientId: device.thingName, count: 4 },
        { bucketStart: "2026-08-17T11:00:00.000Z", clientId: "someone-elses-thing", count: 9 },
      ]),
    );
    vi.spyOn(databricksAdapter, "getDevicesLifecycleEvents").mockResolvedValue(
      success([
        {
          clientId: device.thingName,
          eventType: "disconnected",
          eventTimestamp: "2026-08-17T12:00:00.000Z",
          disconnectReason: "CONNECTION_LOST",
        },
      ]),
    );
    vi.spyOn(databricksAdapter, "getDevicesDataByExperiment").mockResolvedValue(
      success([{ bucketStart: "2026-08-17T10:00:00.000Z", experimentId: null, count: 4 }]),
    );
    vi.spyOn(databricksAdapter, "getDevicesFirmware").mockResolvedValue(
      success([
        { clientId: device.thingName, version: "1.0.0", lastSeen: "2026-08-17T09:00:00.000Z" },
        { clientId: device.thingName, version: "1.1.0", lastSeen: "2026-08-17T11:00:00.000Z" },
      ]),
    );

    const result = await useCase.execute(groupId, WINDOW);

    assertSuccess(result);
    expect(result.value.pipelineUnavailable).toBe(false);
    expect(result.value.members).toHaveLength(1);
    const member = result.value.members[0];
    expect(member.deviceId).toBe(device.id);
    expect(member.connectivity).toEqual({ connected: true, lastSeenAt: null });
    expect(member.lastDataAt).toBe("2026-08-18T10:00:00.000Z");
    // Throughput rows resolve to member device ids; foreign client ids stay null.
    expect(result.value.throughput).toEqual([
      { bucketStart: "2026-08-17T10:00:00.000Z", deviceId: device.id, count: 4 },
      { bucketStart: "2026-08-17T11:00:00.000Z", deviceId: null, count: 9 },
    ]);
    expect(result.value.events).toEqual([
      {
        deviceId: device.id,
        eventType: "disconnected",
        eventTimestamp: "2026-08-17T12:00:00.000Z",
        disconnectReason: "CONNECTION_LOST",
      },
    ]);
    expect(result.value.dataByExperiment).toEqual([
      { bucketStart: "2026-08-17T10:00:00.000Z", experimentId: null, count: 4 },
    ]);
    // Two versions in the window: only the most recently seen one is current.
    expect(result.value.firmware).toEqual([
      { deviceId: device.id, version: "1.1.0", lastSeen: "2026-08-17T11:00:00.000Z" },
    ]);
  });

  it("returns an empty roster without touching AWS or the warehouse", async () => {
    const createGroup = testApp.module.get(CreateIotDeviceGroupUseCase);
    const created = await createGroup.execute({ name: "Empty" }, userId);
    assertSuccess(created);
    const aws = vi.spyOn(awsAdapter, "searchThingsConnectivity");
    const warehouse = vi.spyOn(databricksAdapter, "getDevicesLastActivity");

    const result = await useCase.execute(created.value.id, WINDOW);

    assertSuccess(result);
    expect(result.value).toEqual({
      members: [],
      throughput: [],
      dataByExperiment: [],
      firmware: [],
      events: [],
      pipelineUnavailable: false,
    });
    expect(aws).not.toHaveBeenCalled();
    expect(warehouse).not.toHaveBeenCalled();
  });

  it("degrades connectivity to unknown when the fleet index fails", async () => {
    const { groupId } = await seedGroupWithDevice();
    vi.spyOn(awsAdapter, "searchThingsConnectivity").mockResolvedValue(
      failure(AppError.internal("index down")),
    );
    vi.spyOn(databricksAdapter, "getDevicesLastActivity").mockResolvedValue(success(new Map()));
    vi.spyOn(databricksAdapter, "getDevicesThroughput").mockResolvedValue(success([]));
    vi.spyOn(databricksAdapter, "getDevicesLifecycleEvents").mockResolvedValue(success([]));
    vi.spyOn(databricksAdapter, "getDevicesDataByExperiment").mockResolvedValue(success([]));
    vi.spyOn(databricksAdapter, "getDevicesFirmware").mockResolvedValue(success([]));

    const result = await useCase.execute(groupId, WINDOW);

    assertSuccess(result);
    expect(result.value.members[0].connectivity).toBeNull();
    expect(result.value.pipelineUnavailable).toBe(false);
  });

  it("marks the pipeline unavailable when the warehouse lookup fails", async () => {
    const { groupId } = await seedGroupWithDevice();
    vi.spyOn(awsAdapter, "searchThingsConnectivity").mockResolvedValue(success(new Map()));
    vi.spyOn(databricksAdapter, "getDevicesLastActivity").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );
    vi.spyOn(databricksAdapter, "getDevicesThroughput").mockResolvedValue(success([]));
    vi.spyOn(databricksAdapter, "getDevicesLifecycleEvents").mockResolvedValue(success([]));
    vi.spyOn(databricksAdapter, "getDevicesDataByExperiment").mockResolvedValue(success([]));
    vi.spyOn(databricksAdapter, "getDevicesFirmware").mockResolvedValue(success([]));

    const result = await useCase.execute(groupId, WINDOW);

    assertSuccess(result);
    expect(result.value.pipelineUnavailable).toBe(true);
    expect(result.value.members[0].lastDataAt).toBeNull();
  });

  it("propagates a repository failure", async () => {
    vi.spyOn(groupRepository, "listMemberThings").mockResolvedValue(
      failure(AppError.internal("boom")),
    );

    const result = await useCase.execute("11111111-1111-4111-8111-111111111111", WINDOW);

    assertFailure(result);
  });
});
