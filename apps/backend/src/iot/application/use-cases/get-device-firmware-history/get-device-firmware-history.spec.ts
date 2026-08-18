import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { GetDeviceFirmwareHistoryUseCase } from "./get-device-firmware-history";

const THING = "AMBYTE_A";
const FROM = "2026-08-13T00:00:00.000Z";
const TO = "2026-08-13T12:00:00.000Z";
const BUCKET = "hour" as const;

describe("GetDeviceFirmwareHistoryUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetDeviceFirmwareHistoryUseCase;
  let databricksAdapter: DatabricksAdapter;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    useCase = testApp.module.get(GetDeviceFirmwareHistoryUseCase);
    databricksAdapter = testApp.module.get(DatabricksAdapter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("keeps a rollback visible as three runs, not two collapsed versions", async () => {
    // 1.0.0 -> 1.1.0 -> back to 1.0.0; per-bucket groups arrive chronologically.
    vi.spyOn(databricksAdapter, "getDeviceFirmwareHistory").mockResolvedValue(
      success([
        {
          version: "1.0.0",
          firstSeen: "2026-08-13T01:10:00.000Z",
          lastSeen: "2026-08-13T01:50:00.000Z",
          count: 10,
        },
        {
          version: "1.1.0",
          firstSeen: "2026-08-13T02:05:00.000Z",
          lastSeen: "2026-08-13T02:55:00.000Z",
          count: 12,
        },
        {
          version: "1.0.0",
          firstSeen: "2026-08-13T03:00:00.000Z",
          lastSeen: "2026-08-13T03:45:00.000Z",
          count: 8,
        },
      ]),
    );

    const result = await useCase.execute(THING, FROM, TO, BUCKET);

    assertSuccess(result);
    expect(result.value.map((run) => run.version)).toEqual(["1.0.0", "1.1.0", "1.0.0"]);
  });

  it("folds consecutive buckets of one version into a single run", async () => {
    vi.spyOn(databricksAdapter, "getDeviceFirmwareHistory").mockResolvedValue(
      success([
        {
          version: "1.0.0",
          firstSeen: "2026-08-13T01:10:00.000Z",
          lastSeen: "2026-08-13T01:50:00.000Z",
          count: 10,
        },
        {
          version: "1.0.0",
          firstSeen: "2026-08-13T02:05:00.000Z",
          lastSeen: "2026-08-13T02:55:00.000Z",
          count: 12,
        },
      ]),
    );

    const result = await useCase.execute(THING, FROM, TO, BUCKET);

    assertSuccess(result);
    expect(result.value).toEqual([
      {
        version: "1.0.0",
        firstSeen: "2026-08-13T01:10:00.000Z",
        lastSeen: "2026-08-13T02:55:00.000Z",
        count: 22,
      },
    ]);
  });

  it("returns the versions oldest first, whatever order the warehouse used", async () => {
    vi.spyOn(databricksAdapter, "getDeviceFirmwareHistory").mockResolvedValue(
      success([
        {
          version: "1.1.0",
          firstSeen: "2026-08-13T09:00:00.000Z",
          lastSeen: "2026-08-13T11:00:00.000Z",
          count: 40,
        },
        {
          version: "1.0.0",
          firstSeen: "2026-08-13T01:00:00.000Z",
          lastSeen: "2026-08-13T08:00:00.000Z",
          count: 60,
        },
      ]),
    );

    const result = await useCase.execute(THING, FROM, TO, BUCKET);

    assertSuccess(result);
    expect(result.value.map((entry) => entry.version)).toEqual(["1.0.0", "1.1.0"]);
  });

  it("drops rows that name no version or no window", async () => {
    vi.spyOn(databricksAdapter, "getDeviceFirmwareHistory").mockResolvedValue(
      success([
        {
          version: null,
          firstSeen: "2026-08-13T01:00:00.000Z",
          lastSeen: "2026-08-13T02:00:00.000Z",
          count: 5,
        },
        { version: "1.0.0", firstSeen: null, lastSeen: null, count: 5 },
        {
          version: "1.1.0",
          firstSeen: "2026-08-13T03:00:00.000Z",
          lastSeen: "2026-08-13T04:00:00.000Z",
          count: 5,
        },
      ]),
    );

    const result = await useCase.execute(THING, FROM, TO, BUCKET);

    assertSuccess(result);
    expect(result.value).toEqual([
      {
        version: "1.1.0",
        firstSeen: "2026-08-13T03:00:00.000Z",
        lastSeen: "2026-08-13T04:00:00.000Z",
        count: 5,
      },
    ]);
  });

  it("propagates a warehouse failure", async () => {
    vi.spyOn(databricksAdapter, "getDeviceFirmwareHistory").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );

    const result = await useCase.execute(THING, FROM, TO, BUCKET);

    assertFailure(result);
  });
});
