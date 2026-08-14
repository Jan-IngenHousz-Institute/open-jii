import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DevicePayloadStats } from "@repo/api/domains/iot/iot.schema";

import { PayloadProfile } from "./payload-profile";

function payload(overrides: Partial<DevicePayloadStats> = {}): DevicePayloadStats {
  return {
    totalMeasurements: 200,
    withGps: 50,
    withBattery: 200,
    workbookRuns: 2,
    firmwareMix: [{ version: "1.1.0", count: 200 }],
    protocolMix: [],
    ...overrides,
  };
}

describe("PayloadProfile", () => {
  it("shows metadata coverage as percentages of the total", () => {
    render(<PayloadProfile payload={payload()} />);

    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
  });

  it("survives an empty range without dividing by zero", () => {
    render(
      <PayloadProfile
        payload={payload({ totalMeasurements: 0, withGps: 0, withBattery: 0, firmwareMix: [] })}
      />,
    );

    expect(screen.getAllByText("0%").length).toBeGreaterThan(0);
  });

  it("lists the firmware mix and hides the legacy protocol section when empty", () => {
    render(<PayloadProfile payload={payload()} />);

    expect(screen.getByText(/1\.1\.0/)).toBeInTheDocument();
    expect(screen.queryByText("iot.devices.monitoring.protocols")).not.toBeInTheDocument();
  });

  it("shows the protocol mix with its legacy note when present", () => {
    render(
      <PayloadProfile payload={payload({ protocolMix: [{ protocolId: "proto-1", count: 12 }] })} />,
    );

    expect(screen.getByText(/proto-1/)).toBeInTheDocument();
    expect(screen.getByText("iot.devices.monitoring.protocolLegacyNote")).toBeInTheDocument();
  });
});
