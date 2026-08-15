import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { DeviceExperiment, DeviceMonitoring } from "@repo/api/domains/iot/iot.schema";

import { DataByExperiment } from "./data-by-experiment";

vi.mock("@repo/ui/components/charts/bar-chart", () => ({
  HorizontalBarChart: vi.fn(() => <div data-testid="experiment-bars" />),
}));

const BOUND_ID = "22222222-2222-4222-8222-222222222222";
const MEMBER_ID = "33333333-3333-4333-8333-333333333333";
const FOREIGN_ID = "44444444-4444-4444-8444-444444444444";

const BOUND: DeviceExperiment[] = [
  { id: BOUND_ID, name: "Soil Health", status: "active", addedAt: "2026-08-01T00:00:00.000Z" },
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
      workbookMix: [],
    },
    recentMeasurements: [],
  };
}

function bucket(experimentId: string, count: number) {
  return { bucketStart: "2026-08-13T01:00:00.000Z", experimentId, count };
}

describe("DataByExperiment", () => {
  it("counts data per bound experiment and flags the silent one", () => {
    render(
      <DataByExperiment
        monitoring={monitoringWith([bucket(BOUND_ID, 12)])}
        boundExperiments={[
          ...BOUND,
          { id: MEMBER_ID, name: "Canopy", status: "active", addedAt: "2026-08-01T00:00:00.000Z" },
        ]}
        visibleExperiments={[]}
        locale="en-US"
      />,
    );

    expect(screen.getByText("Soil Health")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    // Canopy is bound but produced nothing in range: flagged, never hidden.
    expect(screen.getByText("iot.devices.monitoring.boundButSilent")).toBeInTheDocument();
  });

  it("names an unonboarded experiment the viewer is a member of, and links it", () => {
    render(
      <DataByExperiment
        monitoring={monitoringWith([bucket(MEMBER_ID, 5)])}
        boundExperiments={BOUND}
        visibleExperiments={[{ id: MEMBER_ID, name: "Canopy" }]}
        locale="en-US"
      />,
    );

    expect(screen.getByRole("link", { name: /Canopy/ })).toHaveAttribute(
      "href",
      `/en-US/platform/experiments/${MEMBER_ID}/data`,
    );
    expect(screen.getByText("iot.devices.monitoring.notBound")).toBeInTheDocument();
  });

  it("keeps an experiment the viewer cannot see unnamed and unlinked", () => {
    render(
      <DataByExperiment
        monitoring={monitoringWith([bucket(FOREIGN_ID, 3)])}
        boundExperiments={BOUND}
        visibleExperiments={[]}
        locale="en-US"
      />,
    );

    // The id itself is withheld: the device publishing there says nothing
    // about this viewer's access to it.
    expect(screen.queryByText(FOREIGN_ID)).not.toBeInTheDocument();
    expect(screen.getByText("iot.devices.monitoring.privateExperiment")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /privateExperiment/ })).not.toBeInTheDocument();
  });

  it("renders the empty state without experiments or data", () => {
    render(
      <DataByExperiment
        monitoring={monitoringWith([])}
        boundExperiments={[]}
        visibleExperiments={[]}
        locale="en-US"
      />,
    );

    expect(screen.getByText("iot.devices.monitoring.noExperiments")).toBeInTheDocument();
  });
});
