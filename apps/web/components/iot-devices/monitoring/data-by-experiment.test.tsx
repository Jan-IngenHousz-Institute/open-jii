import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DeviceExperiment, DeviceMonitoring } from "@repo/api/domains/iot/iot.schema";

import { DataByExperiment } from "./data-by-experiment";

const BOUND: DeviceExperiment[] = [
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Soil Health",
    status: "active",
    addedAt: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Canopy",
    status: "active",
    addedAt: "2026-08-01T00:00:00.000Z",
  },
];

function monitoringWith(throughput: DeviceMonitoring["throughput"]): DeviceMonitoring {
  return {
    bucket: "hour",
    events: [],
    sessions: [],
    uptimePercent: null,
    truncated: false,
    throughput,
    battery: [],
    payload: {
      totalMeasurements: 0,
      withGps: 0,
      withBattery: 0,
      workbookRuns: 0,
      firmwareMix: [],
      protocolMix: [],
    },
  };
}

describe("DataByExperiment", () => {
  it("counts data per bound experiment and flags the silent one", () => {
    render(
      <DataByExperiment
        monitoring={monitoringWith([
          { bucketStart: "2026-08-13T01:00:00.000Z", experimentId: BOUND[0].id, count: 12 },
        ])}
        boundExperiments={BOUND}
      />,
    );

    expect(screen.getByText("Soil Health")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    // Canopy is bound but produced nothing in range: flagged, never hidden.
    expect(screen.getByText("Canopy")).toBeInTheDocument();
    expect(screen.getByText("iot.devices.monitoring.boundButSilent")).toBeInTheDocument();
  });

  it("surfaces data arriving for an experiment the device is not bound to", () => {
    render(
      <DataByExperiment
        monitoring={monitoringWith([
          {
            bucketStart: "2026-08-13T01:00:00.000Z",
            experimentId: "44444444-4444-4444-8444-444444444444",
            count: 3,
          },
        ])}
        boundExperiments={[]}
      />,
    );

    expect(screen.getByText("iot.devices.monitoring.notBound")).toBeInTheDocument();
  });

  it("renders the empty state without experiments or data", () => {
    render(<DataByExperiment monitoring={monitoringWith([])} boundExperiments={[]} />);

    expect(screen.getByText("iot.devices.monitoring.noExperiments")).toBeInTheDocument();
  });
});
