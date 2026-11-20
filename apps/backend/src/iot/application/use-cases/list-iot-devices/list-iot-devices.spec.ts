import { AwsAdapter } from "../../../../common/modules/aws/aws.adapter";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { ThingConnectivity } from "../../../core/ports/aws.port";
import { ExperimentDeviceRepository } from "../../../core/repositories/experiment-device.repository";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";
import { ListIotDevicesUseCase } from "./list-iot-devices";

describe("ListIotDevicesUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: ListIotDevicesUseCase;
  let awsAdapter: AwsAdapter;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    useCase = testApp.module.get(ListIotDevicesUseCase);
    awsAdapter = testApp.module.get(AwsAdapter);
    vi.spyOn(awsAdapter, "searchThingsConnectivity").mockResolvedValue(success(new Map()));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("lists the user's own devices", async () => {
    await testApp.createIotDevice({ createdBy: userId });
    await testApp.createIotDevice({ createdBy: userId });

    const result = await useCase.execute(userId);

    assertSuccess(result);
    expect(result.value).toHaveLength(2);
  });

  it("does not list other users' devices", async () => {
    const otherUser = await testApp.createTestUser({});
    await testApp.createIotDevice({ createdBy: otherUser });

    const result = await useCase.execute(userId);

    assertSuccess(result);
    expect(result.value).toHaveLength(0);
  });

  it("enriches each device with its fleet-index connectivity", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    const connectivity: ThingConnectivity = {
      thingName: device.thingName,
      connected: true,
      lastSeenAt: "2026-08-13T10:00:00.000Z",
    };
    vi.spyOn(awsAdapter, "searchThingsConnectivity").mockResolvedValue(
      success(new Map([[device.thingName, connectivity]])),
    );

    const result = await useCase.execute(userId);

    assertSuccess(result);
    expect(result.value[0].connectivity).toEqual({
      connected: true,
      lastSeenAt: "2026-08-13T10:00:00.000Z",
    });
  });

  it("renders devices absent from the index with null connectivity", async () => {
    await testApp.createIotDevice({ createdBy: userId });

    const result = await useCase.execute(userId);

    assertSuccess(result);
    expect(result.value[0].connectivity).toBeNull();
  });

  it("degrades to null connectivity when the fleet index is unavailable, never failing the list", async () => {
    await testApp.createIotDevice({ createdBy: userId });
    vi.spyOn(awsAdapter, "searchThingsConnectivity").mockResolvedValue(
      failure(AppError.internal("index down")),
    );

    const result = await useCase.execute(userId);

    assertSuccess(result);
    expect(result.value).toHaveLength(1);
    expect(result.value[0].connectivity).toBeNull();
  });

  it("skips the fleet-index lookup entirely for an empty device list", async () => {
    const search = vi.spyOn(awsAdapter, "searchThingsConnectivity");

    const result = await useCase.execute(userId);

    assertSuccess(result);
    expect(result.value).toHaveLength(0);
    expect(search).not.toHaveBeenCalled();
  });

  it("fails when the binding count cannot be read, rather than listing every device as unbound", async () => {
    await testApp.createIotDevice({ createdBy: userId });
    vi.spyOn(
      testApp.module.get(ExperimentDeviceRepository),
      "countByDevices",
    ).mockResolvedValueOnce(failure(AppError.internal("db down")));

    assertFailure(await useCase.execute(userId));
  });

  it("enriches only the requested page and returns counts and default paging metadata", async () => {
    for (let index = 0; index < 23; index++) {
      await testApp.createIotDevice({ createdBy: userId });
    }
    const bindings = vi.spyOn(testApp.module.get(ExperimentDeviceRepository), "countByDevices");
    const connectivity = vi.spyOn(awsAdapter, "searchThingsConnectivity");
    const result = await useCase.execute(userId, { page: 1 });
    assertSuccess(result);
    expect(result.value.items).toHaveLength(20);
    expect(result.value).toMatchObject({
      page: 1,
      pageSize: 20,
      totalCount: 23,
      totalPages: 2,
      statusCounts: { registered: 23, provisioned: 0, onboarded: 0, revoked: 0, retired: 0 },
    });
    expect(bindings).toHaveBeenCalledExactlyOnceWith(result.value.items.map((device) => device.id));
    expect(connectivity).toHaveBeenCalledExactlyOnceWith(
      result.value.items.map((device) => device.thingName),
    );
  });

  it("keeps totals for an out-of-range page and skips connectivity for its empty rows", async () => {
    await testApp.createIotDevice({ createdBy: userId });
    const connectivity = vi.spyOn(awsAdapter, "searchThingsConnectivity");
    const result = await useCase.execute(userId, { page: 3, pageSize: 1 });
    assertSuccess(result);
    expect(result.value).toMatchObject({ items: [], page: 3, totalCount: 1, totalPages: 1 });
    expect(connectivity).not.toHaveBeenCalled();
  });

  it("returns at least one total page and all zero counts for an empty listing", async () => {
    const result = await useCase.execute(userId, { page: 1 });
    assertSuccess(result);
    expect(result.value).toMatchObject({
      items: [],
      totalCount: 0,
      totalPages: 1,
      statusCounts: { registered: 0, provisioned: 0, onboarded: 0, revoked: 0, retired: 0 },
    });
  });

  it("returns filtered and sorted arrays without page even when pageSize is supplied", async () => {
    await testApp.createIotDevice({ createdBy: userId, name: "B sensor", deviceType: "multispeq" });
    await testApp.createIotDevice({ createdBy: userId, name: "A sensor", deviceType: "multispeq" });
    await testApp.createIotDevice({ createdBy: userId, name: "Other", deviceType: "generic" });
    const result = await useCase.execute(userId, {
      search: "sensor",
      family: ["multispeq"],
      sort: [{ field: "name", direction: "asc" }],
      pageSize: 1,
    });
    assertSuccess(result);
    expect(Array.isArray(result.value)).toBe(true);
    if (!Array.isArray(result.value)) throw new Error("Expected legacy array");
    expect(result.value.map((device) => device.name)).toEqual(["A sensor", "B sensor"]);
  });

  it("preserves the legacy accessible ordering when no listing input is supplied", async () => {
    await testApp.createIotDevice({ createdBy: userId });
    await testApp.createIotDevice({ createdBy: userId });
    const legacy = await testApp.module.get(IotDeviceRepository).listAccessible(userId);
    const result = await useCase.execute(userId);
    assertSuccess(legacy);
    assertSuccess(result);
    expect(result.value).toEqual(
      legacy.value.map((device) => ({ ...device, connectivity: null, boundExperimentCount: 0 })),
    );
  });

  it("degrades paged connectivity failure to null for each returned row", async () => {
    await testApp.createIotDevice({ createdBy: userId });
    vi.spyOn(awsAdapter, "searchThingsConnectivity").mockResolvedValue(
      failure(AppError.internal("index down")),
    );
    const result = await useCase.execute(userId, { page: 1 });
    assertSuccess(result);
    expect(result.value.items[0].connectivity).toBeNull();
  });
});
