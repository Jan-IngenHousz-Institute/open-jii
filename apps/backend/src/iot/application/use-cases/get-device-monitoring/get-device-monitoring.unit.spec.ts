import { Logger } from "@nestjs/common";
import { fromPartial } from "@total-typescript/shoehorn";

import type { DevicePower } from "@repo/api/domains/iot/device-power.schema";
import { zDeviceMonitoring } from "@repo/api/domains/iot/iot.schema";
import type { IotDevice } from "@repo/api/domains/iot/iot.schema";

import { AppError, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
import { GetDeviceMonitoringUseCase } from "./get-device-monitoring";

const from = "2026-01-01T00:00:00Z";
const to = "2026-01-01T04:00:00Z";

function setup(power: DevicePower, deviceType: IotDevice["deviceType"] = "ambyte") {
  const getDevicePower = vi
    .fn<DatabricksPort["getDevicePower"]>()
    .mockResolvedValue(success(power));
  const useCase = new GetDeviceMonitoringUseCase(
    fromPartial({
      findById: () =>
        Promise.resolve(success(fromPartial({ thingName: "synthetic-unit", deviceType }))),
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

  it("logs a power-query failure while preserving the rest of monitoring", async () => {
    const { useCase, getDevicePower } = setup({ latest: null, lastValidBattery: null });
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    getDevicePower.mockResolvedValue(failure(AppError.internal("warehouse unavailable")));
    const result = await useCase.execute("synthetic-id", from, to, "hour", "synthetic-user");
    assertSuccess(result);
    expect(result.value.power).toBeUndefined();
    expect(result.value.uptimePercent).toBe(75);
    expect(result.value.battery).toEqual([{ bucketStart: from, averageBattery: 85 }]);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "getDeviceMonitoring",
        deviceId: "synthetic-id",
      }),
    );
    warn.mockRestore();
  });

  it.each(["mobile", "multispeq"] as const)(
    "does not query Ambyte telemetry for %s devices",
    async (deviceType) => {
      const { useCase, getDevicePower } = setup(
        { latest: null, lastValidBattery: null },
        deviceType,
      );
      const result = await useCase.execute("synthetic-id", from, to, "hour", "synthetic-user");
      assertSuccess(result);
      expect(result.value.power).toBeUndefined();
      expect(getDevicePower).not.toHaveBeenCalled();
    },
  );
});
