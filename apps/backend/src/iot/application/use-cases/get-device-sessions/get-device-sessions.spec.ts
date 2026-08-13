import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { GetDeviceSessionsUseCase } from "./get-device-sessions";

const THING = "AMBYTE_A";
const FROM = "2026-08-13T00:00:00.000Z";
const TO = "2026-08-13T12:00:00.000Z";

function event(
  eventType: "connected" | "disconnected",
  eventTimestamp: string,
  disconnectReason: string | null = null,
) {
  return { eventType, eventTimestamp, disconnectReason, sessionIdentifier: "s-1" };
}

describe("GetDeviceSessionsUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetDeviceSessionsUseCase;
  let databricksAdapter: DatabricksAdapter;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    useCase = testApp.module.get(GetDeviceSessionsUseCase);
    databricksAdapter = testApp.module.get(DatabricksAdapter);
    vi.spyOn(databricksAdapter, "getDeviceLifecycleEvents").mockResolvedValue(success([]));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("pairs connect/disconnect events into a closed session with its disconnect reason", async () => {
    vi.spyOn(databricksAdapter, "getDeviceLifecycleEvents").mockResolvedValue(
      success([
        event("connected", "2026-08-13T01:00:00.000Z"),
        event("disconnected", "2026-08-13T03:00:00.000Z", "MQTT_KEEP_ALIVE_TIMEOUT"),
      ]),
    );

    const result = await useCase.execute(THING, FROM, TO);

    assertSuccess(result);
    expect(result.value.sessions).toEqual([
      {
        start: "2026-08-13T01:00:00.000Z",
        end: "2026-08-13T03:00:00.000Z",
        openStart: false,
        durationSeconds: 7200,
        disconnectReason: "MQTT_KEEP_ALIVE_TIMEOUT",
      },
    ]);
  });

  it("treats a leading disconnect as a session already running at range start", async () => {
    vi.spyOn(databricksAdapter, "getDeviceLifecycleEvents").mockResolvedValue(
      success([event("disconnected", "2026-08-13T02:00:00.000Z", "CONNECTION_LOST")]),
    );

    const result = await useCase.execute(THING, FROM, TO);

    assertSuccess(result);
    expect(result.value.sessions).toEqual([
      {
        start: FROM,
        end: "2026-08-13T02:00:00.000Z",
        openStart: true,
        durationSeconds: 7200,
        disconnectReason: "CONNECTION_LOST",
      },
    ]);
  });

  it("leaves a trailing connect as an open-ended session with computable uptime", async () => {
    vi.spyOn(databricksAdapter, "getDeviceLifecycleEvents").mockResolvedValue(
      success([event("connected", "2026-08-13T05:00:00.000Z")]),
    );

    const result = await useCase.execute(THING, FROM, TO);

    assertSuccess(result);
    expect(result.value.sessions).toHaveLength(1);
    expect(result.value.sessions[0].end).toBeNull();
    expect(result.value.sessions[0].openStart).toBe(false);
    expect(result.value.uptimePercent).not.toBeNull();
  });

  it("keeps the earliest start when connect events repeat without a disconnect", async () => {
    vi.spyOn(databricksAdapter, "getDeviceLifecycleEvents").mockResolvedValue(
      success([
        event("connected", "2026-08-13T01:00:00.000Z"),
        event("connected", "2026-08-13T02:00:00.000Z"),
        event("disconnected", "2026-08-13T04:00:00.000Z"),
      ]),
    );

    const result = await useCase.execute(THING, FROM, TO);

    assertSuccess(result);
    expect(result.value.sessions).toHaveLength(1);
    expect(result.value.sessions[0].start).toBe("2026-08-13T01:00:00.000Z");
    expect(result.value.sessions[0].durationSeconds).toBe(3 * 3600);
  });

  it("reports unknown uptime for a range without events", async () => {
    const result = await useCase.execute(THING, FROM, TO);

    assertSuccess(result);
    expect(result.value.sessions).toEqual([]);
    expect(result.value.uptimePercent).toBeNull();
    expect(result.value.truncated).toBe(false);
  });

  it("flags truncation past the event cap", async () => {
    const events = Array.from({ length: 1001 }, (_, i) =>
      event(
        i % 2 === 0 ? "connected" : "disconnected",
        new Date(1755043200000 + i * 1000).toISOString(),
      ),
    );
    vi.spyOn(databricksAdapter, "getDeviceLifecycleEvents").mockResolvedValue(success(events));

    const result = await useCase.execute(THING, FROM, TO);

    assertSuccess(result);
    expect(result.value.truncated).toBe(true);
    expect(result.value.events).toHaveLength(1000);
  });

  it("propagates a warehouse failure", async () => {
    vi.spyOn(databricksAdapter, "getDeviceLifecycleEvents").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );

    const result = await useCase.execute(THING, FROM, TO);

    assertFailure(result);
  });
});
