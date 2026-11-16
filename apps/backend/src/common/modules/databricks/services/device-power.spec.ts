import { fromPartial } from "@total-typescript/shoehorn";

import { zDevicePower } from "@repo/api/domains/iot/device-power.schema";

import { GetDeviceBatteryUseCase } from "../../../../iot/application/use-cases/get-device-battery/get-device-battery";
import { assertFailure, assertSuccess, success, failure, AppError } from "../../../utils/fp-utils";
import { DatabricksAdapter } from "../databricks.adapter";
import type { DatabricksSqlService } from "./sql/sql.service";

const at = "2026-01-01T03:00:00.000Z";
const entry = (battery: number | null, valid = true) =>
  JSON.stringify({
    schema: "ambyte.telemetry/1",
    health: {
      power: { valid, battery_v: battery, system_v: 4.1, charge_status: 2, charge_ma: 122 },
      power_protect: {
        state: "no_flash",
        reason: "low_voltage",
        since_utc: 1767225600,
        skipped: { flash_runs: 3, ambit_runs: 0, ota: 0 },
      },
    },
  });

function setup(columns: string[], rows: (string | null)[][]) {
  const executeSqlQuery = vi.fn<DatabricksSqlService["executeSqlQuery"]>().mockResolvedValue(
    success({
      columns: columns.map((name, position) => ({
        name,
        position,
        type_name: "STRING",
        type_text: "STRING",
      })),
      rows,
      totalRows: rows.length,
      truncated: false,
    }),
  );
  const adapter = new DatabricksAdapter(
    fromPartial({}),
    fromPartial({}),
    fromPartial({ executeSqlQuery }),
    fromPartial({}),
    fromPartial({
      getCatalogName: () => "test_catalog",
      getCentrumSchemaName: () => "centrum",
      getMetricsSchemaName: () => "metrics",
      getRawDataTableName: () => "raw",
      getDeviceDataTableName: () => "devices",
      getMacroDataTableName: () => "macros",
      getUploadedDataTableName: () => "uploads",
    }),
  );
  return { adapter, executeSqlQuery };
}

describe("device power warehouse boundary", () => {
  it("keeps the latest invalid VBAT separate from an older valid reading and protection", async () => {
    const { adapter, executeSqlQuery } = setup(
      ["latest_at", "latest_entry", "last_valid_at", "last_valid_entry"],
      [[at, entry(0), "2026-01-01T02:00:00.000Z", entry(3.8)]],
    );
    const result = await adapter.getDevicePower("synthetic'unit", "2026-01-01T00:00:00Z", at);
    assertSuccess(result);
    expect(zDevicePower.parse(JSON.parse(JSON.stringify(result.value)))).toMatchObject({
      latest: {
        batteryV: 0,
        systemV: 4.1,
        protection: { state: "no_flash", skipped: { flashRuns: 3 } },
      },
      lastValidBattery: { batteryV: 3.8, capturedAt: "2026-01-01T02:00:00.000Z" },
    });
    const [, sql, parameters] = executeSqlQuery.mock.calls[0];
    expect(sql).not.toContain("synthetic'unit");
    expect(sql).toContain("timestamp BETWEEN :from AND :to");
    expect(parameters).toContainEqual({
      name: "thingName",
      value: "synthetic'unit",
      type: "STRING",
    });
  });

  it.each([
    { rows: [] },
    { rows: [[null, null, null, null]] },
    { rows: [[at, "invalid JSON", null, null]] },
  ])("returns unavailable for empty or malformed telemetry", async ({ rows }) => {
    const { adapter } = setup(
      ["latest_at", "latest_entry", "last_valid_at", "last_valid_entry"],
      rows,
    );
    const result = await adapter.getDevicePower("synthetic", at, at);
    assertSuccess(result);
    expect(result.value).toEqual({ latest: null, lastValidBattery: null });
  });

  it("serializes battery coverage and newest null through the use case", async () => {
    const { adapter } = setup(
      [
        "bucket_start",
        "average_battery",
        "sample_count",
        "reported_count",
        "latest_at",
        "latest_battery",
        "last_reported_at",
      ],
      [
        [
          "2026-01-01 03:00:00",
          "3.8",
          "2",
          "1",
          "2026-01-01 03:45:00",
          null,
          "2026-01-01 03:15:00",
        ],
        ["2026-01-01 04:00:00", null, "1", "0", "2026-01-01 04:30:00", null, null],
      ],
    );
    const useCase = new GetDeviceBatteryUseCase(adapter);
    const result = await useCase.execute(
      "synthetic",
      "2026-01-01T00:00:00Z",
      "2026-01-01T05:00:00Z",
      "hour",
    );
    assertSuccess(result);
    expect(result.value).toEqual([
      {
        bucketStart: at,
        averageBattery: 3.8,
        sampleCount: 2,
        reportedCount: 1,
        latestAt: "2026-01-01T03:45:00.000Z",
        latestBattery: null,
        lastReportedAt: "2026-01-01T03:15:00.000Z",
      },
      {
        bucketStart: "2026-01-01T04:00:00.000Z",
        averageBattery: null,
        sampleCount: 1,
        reportedCount: 0,
        latestAt: "2026-01-01T04:30:00.000Z",
        latestBattery: null,
        lastReportedAt: null,
      },
    ]);
  });

  it("propagates a warehouse failure", async () => {
    const { adapter, executeSqlQuery } = setup([], []);
    executeSqlQuery.mockResolvedValue(failure(AppError.internal("unavailable")));
    assertFailure(await adapter.getDevicePower("synthetic", at, at));
  });
});
