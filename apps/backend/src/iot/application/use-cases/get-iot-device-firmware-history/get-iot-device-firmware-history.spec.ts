import { faker } from "@faker-js/faker";

import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import { assertFailure, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { DeviceDataSource } from "../../../core/models/device-data.model";
import { IOT_SERVING_STORE_PORT } from "../../../core/ports/serving-store.port";
import type { ServingStorePort } from "../../../core/ports/serving-store.port";
import { GetDeviceFirmwareHistoryUseCase } from "../get-device-firmware-history/get-device-firmware-history";
import { GetIotDeviceFirmwareHistoryUseCase } from "./get-iot-device-firmware-history";

const RANGE = { from: "2026-07-15T00:00:00.000Z", to: "2026-08-14T00:00:00.000Z" } as const;
const SOURCES: DeviceDataSource[] = ["warehouse", "store"];

describe("GetIotDeviceFirmwareHistoryUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetIotDeviceFirmwareHistoryUseCase;
  let inner: GetDeviceFirmwareHistoryUseCase;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    useCase = testApp.module.get(GetIotDeviceFirmwareHistoryUseCase);
    inner = testApp.module.get(GetDeviceFirmwareHistoryUseCase);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it.each(SOURCES)("resolves the device's thing name before reading the %s", async (source) => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    const execute = vi.spyOn(inner, "execute").mockResolvedValue(success([]));

    const result = await useCase.execute(device.id, RANGE.from, RANGE.to, "day", source);

    assertSuccess(result);
    expect(execute).toHaveBeenCalledWith(device.thingName, RANGE.from, RANGE.to, "day", source);
  });

  it("reads the store, not the warehouse, when the source is the store", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    const rows = [
      {
        version: "1.3.0",
        firstSeen: "2026-08-01T00:00:00.000Z",
        lastSeen: "2026-08-01T00:00:00.000Z",
        count: 5,
      },
      {
        version: "1.3.0",
        firstSeen: "2026-08-02T00:00:00.000Z",
        lastSeen: "2026-08-02T00:00:00.000Z",
        count: 2,
      },
    ];
    const servingStore: ServingStorePort = testApp.module.get(IOT_SERVING_STORE_PORT);
    const warehouse = vi
      .spyOn(testApp.module.get(DatabricksAdapter), "getDeviceFirmwareHistory")
      .mockResolvedValue(success(rows));
    const store = vi
      .spyOn(servingStore, "getDeviceFirmwareHistory")
      .mockResolvedValue(success(rows));

    const fromWarehouse = await useCase.execute(
      device.id,
      RANGE.from,
      RANGE.to,
      "day",
      "warehouse",
    );
    const fromStore = await useCase.execute(device.id, RANGE.from, RANGE.to, "day", "store");

    assertSuccess(fromWarehouse);
    assertSuccess(fromStore);
    expect(fromStore.value).toEqual(fromWarehouse.value);
    expect(fromStore.value).toEqual([
      {
        version: "1.3.0",
        firstSeen: "2026-08-01T00:00:00.000Z",
        lastSeen: "2026-08-02T00:00:00.000Z",
        count: 7,
      },
    ]);
    expect(warehouse).toHaveBeenCalledOnce();
    expect(store).toHaveBeenCalledWith(device.thingName, RANGE.from, RANGE.to, "day");
  });

  it("returns 404 for a device that does not exist", async () => {
    const result = await useCase.execute(
      faker.string.uuid(),
      RANGE.from,
      RANGE.to,
      "day",
      "warehouse",
    );

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("passes a warehouse failure through", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    vi.spyOn(inner, "execute").mockResolvedValue(failure(AppError.internal("boom")));

    const result = await useCase.execute(device.id, RANGE.from, RANGE.to, "day", "warehouse");

    assertFailure(result);
    expect(result.error.statusCode).toBe(500);
  });
});
