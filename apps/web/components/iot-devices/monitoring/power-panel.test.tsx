import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DevicePowerReading } from "@repo/api/domains/iot/device-power.schema";
import { extractAmbytePower } from "@repo/api/transforms/ambyte-power";

import { PowerPanel } from "./power-panel";

function reading(overrides: Partial<DevicePowerReading> = {}): DevicePowerReading {
  return {
    capturedAt: "2026-01-01T01:00:00.000Z",
    valid: true,
    reason: "ok",
    batteryV: 3.8,
    systemV: 4.1,
    chargeStatus: 2,
    chargeMa: 122,
    protection: null,
    ...overrides,
  };
}

describe("PowerPanel", () => {
  it("shows unavailable VBAT alongside healthy VSYS and a dated last valid reading", () => {
    render(
      <PowerPanel
        power={{
          latest: reading({ batteryV: 0 }),
          lastValidBattery: { batteryV: 3.8, capturedAt: "2026-01-01T00:00:00Z" },
        }}
      />,
    );
    expect(screen.getByText("iot.devices.monitoring.powerVbat").parentElement).toHaveTextContent(
      "iot.devices.monitoring.batteryMissing",
    );
    expect(screen.getByText("iot.devices.monitoring.powerVsys").parentElement).toHaveTextContent(
      "4.10 V",
    );
    expect(
      screen.getByText("iot.devices.monitoring.powerLastBattery").parentElement,
    ).toHaveTextContent("2026");
    expect(screen.getByText("iot.devices.monitoring.powerUnknown")).toBeInTheDocument();
  });

  it("shows no_flash independently of reported charging", () => {
    const latest = extractAmbytePower(
      {
        schema: "ambyte.telemetry/1",
        health: {
          power: { valid: true, battery_v: 3.7, system_v: 4.1, charge_status: 2, charge_ma: 227 },
          power_protect: {
            state: "no_flash",
            reason: "low_voltage",
            since_utc: 1767225600,
            skipped: { flash_runs: 3, ambit_runs: 0, ota: 0 },
          },
        },
      },
      "2026-01-01T01:00:00Z",
    );
    render(<PowerPanel power={{ latest, lastValidBattery: null }} />);
    expect(screen.getByText("iot.devices.monitoring.powerNoFlash")).toBeInTheDocument();
    expect(
      screen.getByText("iot.devices.monitoring.powerChargeCurrent").parentElement,
    ).toHaveTextContent("227 mA");
    expect(
      screen.getByText("iot.devices.monitoring.powerSkippedFlash").parentElement,
    ).toHaveTextContent("3");
    expect(screen.getByText("iot.devices.monitoring.powerSince").parentElement).toHaveTextContent(
      "2026",
    );
  });

  it("does not use a voltage from an invalid frame", () => {
    render(<PowerPanel power={{ latest: reading({ valid: false }), lastValidBattery: null }} />);
    expect(screen.getByText("iot.devices.monitoring.powerVbat").parentElement).toHaveTextContent(
      "iot.devices.monitoring.batteryMissing",
    );
    expect(screen.queryByText("3.80 V")).not.toBeInTheDocument();
  });

  it.each([0, 3600, 1577836799])(
    "treats an unsynced protection start %s as unavailable",
    (sinceUtc) => {
      render(
        <PowerPanel
          power={{
            latest: reading({
              protection: {
                state: "no_flash",
                reason: "low_voltage",
                sinceUtc,
                skipped: { flashRuns: 0, ambitRuns: 0, ota: 0 },
              },
            }),
            lastValidBattery: null,
          }}
        />,
      );
      expect(screen.getByText("iot.devices.monitoring.powerSince").parentElement).toHaveTextContent(
        "iot.devices.monitoring.batteryMissing",
      );
    },
  );

  it.each([
    [0, "powerNotCharging"],
    [1, "powerTrickle"],
    [2, "powerConstantCurrent"],
    [3, "powerChargeDone"],
    [4, "powerUnknown"],
  ] as const)("labels charge state %s", (chargeStatus, label) => {
    render(<PowerPanel power={{ latest: reading({ chargeStatus }), lastValidBattery: null }} />);
    expect(
      screen.getByText("iot.devices.monitoring.powerChargeState").parentElement,
    ).toHaveTextContent(`iot.devices.monitoring.${label}`);
  });

  it("retains a reported hold when power and skipped counters are missing", () => {
    const latest = extractAmbytePower(
      { schema: "ambyte.telemetry/1", health: { power_protect: { state: "hold" } } },
      "2026-01-01T01:00:00Z",
    );
    render(<PowerPanel power={{ latest, lastValidBattery: null }} />);
    expect(screen.getByText("iot.devices.monitoring.powerHold")).toBeInTheDocument();
    expect(
      screen.getByText("iot.devices.monitoring.powerSkippedFlash").parentElement,
    ).toHaveTextContent("iot.devices.monitoring.batteryMissing");
  });

  it("shows an explicit unavailable state for legacy and empty ranges", () => {
    render(<PowerPanel power={undefined} />);
    expect(screen.getByRole("status")).toHaveTextContent("iot.devices.monitoring.powerUnavailable");
  });

  it("flags a future device timestamp", () => {
    render(
      <PowerPanel
        power={{ latest: reading({ capturedAt: "2099-01-01T00:00:00Z" }), lastValidBattery: null }}
      />,
    );
    expect(screen.getByText("iot.devices.monitoring.powerFuture")).toBeInTheDocument();
  });
});
