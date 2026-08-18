import { AwsAdapter } from "../../../../common/modules/aws/aws.adapter";
import { AppError, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { ThingConnectivity } from "../../../core/ports/aws.port";
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
});
