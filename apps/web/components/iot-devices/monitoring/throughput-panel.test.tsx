import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { DeviceExperiment, DeviceMonitoring } from "@repo/api/domains/iot/iot.schema";

import { ThroughputPanel } from "./throughput-panel";

vi.mock("@repo/ui/components/charts/bar-chart", () => ({
  BarChart: vi.fn(({ data }: { data: { name: string }[] }) => (
    <div data-testid="bar-chart">{JSON.stringify(data.map((series) => series.name))}</div>
  )),
}));

const FROM = "2026-08-13T00:00:00.000Z";
const TO = "2026-08-13T02:00:00.000Z";

function experiment(id: string, name: string): DeviceExperiment {
  return { id, name, status: "active", addedAt: "2026-08-01T00:00:00.000Z" };
}

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

const FIVE_EXPERIMENTS = ["a", "b", "c", "d", "e"].map((letter) =>
  experiment(`${letter}0000000-0000-4000-8000-000000000000`, `Exp ${letter.toUpperCase()}`),
);

describe("ThroughputPanel", () => {
  it("folds experiments past the palette into a single Other series", () => {
    render(
      <ThroughputPanel
        monitoring={monitoringWith(
          FIVE_EXPERIMENTS.map((bound) => ({
            bucketStart: FROM,
            experimentId: bound.id,
            count: 2,
          })),
        )}
        boundExperiments={FIVE_EXPERIMENTS}
        from={FROM}
        to={TO}
      />,
    );

    const seriesNames = JSON.parse(screen.getByTestId("bar-chart").textContent) as string[];
    expect(seriesNames).toHaveLength(4);
    expect(seriesNames[3]).toBe("iot.devices.monitoring.otherSeries");
  });

  it("labels measurements without an experiment attribution", () => {
    render(
      <ThroughputPanel
        monitoring={monitoringWith([{ bucketStart: FROM, experimentId: null, count: 3 }])}
        boundExperiments={[]}
        from={FROM}
        to={TO}
      />,
    );

    const seriesNames = JSON.parse(screen.getByTestId("bar-chart").textContent) as string[];
    expect(seriesNames).toEqual(["iot.devices.monitoring.unknownExperiment"]);
  });

  it("offers the zero-filled table as the chart's accessible counterpart", async () => {
    const user = userEvent.setup();
    render(
      <ThroughputPanel
        monitoring={monitoringWith([
          { bucketStart: "2026-08-13T01:00:00.000Z", experimentId: null, count: 3 },
        ])}
        boundExperiments={[]}
        from={FROM}
        to={TO}
      />,
    );

    await user.click(screen.getByRole("radio", { name: "iot.devices.monitoring.viewTable" }));

    // Header plus one row per bucket in the range, silent buckets included.
    expect(screen.getAllByRole("row")).toHaveLength(4);
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
