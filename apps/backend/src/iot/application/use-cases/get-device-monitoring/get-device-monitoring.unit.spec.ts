import { fromPartial } from "@total-typescript/shoehorn";

import type { DevicePower } from "@repo/api/domains/iot/device-power.schema";
import { zDeviceMonitoring } from "@repo/api/domains/iot/iot.schema";

import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
import { GetDeviceMonitoringUseCase } from "./get-device-monitoring";

const from = "2026-01-01T00:00:00Z";
const to = "2026-01-01T04:00:00Z";

function setup(power: DevicePower) {
  const getDevicePower = vi
    .fn<DatabricksPort["getDevicePower"]>()
    .mockResolvedValue(success(power));
  const useCase = new GetDeviceMonitoringUseCase(
    fromPartial({
      findById: () => Promise.resolve(success(fromPartial({ thingName: "synthetic-unit" }))),
    }),
    fromPartial({
      execute: () =>
        Promise.resolve(success({ events: [], sessions: [], uptimePercent: 75, truncated: false })),
    }),
    fromPartial({ execute: () => Promise.resolve(success([])) }),
    fromPartial({
      execute: () => Promise.resolve(success([{ bucketStart: from, averageBattery: 85 }])),
    }),
    fromPartial({
      execute: () =>
        Promise.resolve(
          success({
            totalMeasurements: 1,
            withGps: 0,
            withBattery: 1,
            workbookRuns: 0,
            firmwareMix: [],
            protocolMix: [],
            workbookMix: [],
            macroMix: [],
          }),
        ),
    }),
    fromPartial({ execute: () => Promise.resolve(success([])) }),
    fromPartial({ execute: () => Promise.resolve(success([])) }),
    fromPartial({ getDevicePower }),
  );
  return { useCase, getDevicePower };
}

describe("monitoring power response assembly", () => {
  it("keeps protection separate from connectivity and legacy battery units", async () => {
    const power: DevicePower = {
      latest: {
        capturedAt: "2026-01-01T03:00:00.000Z",
        valid: true,
        reason: "ok",
        batteryV: 0,
        systemV: 4.1,
        chargeStatus: 2,
        chargeMa: 122,
        protection: {
          state: "no_flash",
          reason: "low_voltage",
          sinceUtc: 1767225600,
          skipped: { flashRuns: 3, ambitRuns: 0, ota: 0 },
        },
      },
      lastValidBattery: { capturedAt: "2026-01-01T02:00:00.000Z", batteryV: 3.8 },
    };
    const { useCase, getDevicePower } = setup(power);
    const result = await useCase.execute("synthetic-id", from, to, "hour", "synthetic-user");
    assertSuccess(result);
    const serialized = zDeviceMonitoring.parse(JSON.parse(JSON.stringify(result.value)));
    expect(serialized.power).toEqual(power);
    expect(serialized.uptimePercent).toBe(75);
    expect(serialized.battery).toEqual([{ bucketStart: from, averageBattery: 85 }]);
    expect(getDevicePower).toHaveBeenCalledWith("synthetic-unit", from, to);
  });

  it("retains unavailable power instead of manufacturing a healthy state", async () => {
    const { useCase } = setup({ latest: null, lastValidBattery: null });
    const result = await useCase.execute("synthetic-id", from, to, "day", "synthetic-user");
    assertSuccess(result);
    expect(result.value.power).toEqual({ latest: null, lastValidBattery: null });
  });

  it("surfaces a power-query failure instead of presenting it as missing telemetry", async () => {
    const { useCase, getDevicePower } = setup({ latest: null, lastValidBattery: null });
    getDevicePower.mockResolvedValue(failure(AppError.internal("warehouse unavailable")));
    const result = await useCase.execute("synthetic-id", from, to, "hour", "synthetic-user");
    assertFailure(result);
    expect(result.error.message).toBe("warehouse unavailable");
  });
});
