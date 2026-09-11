import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { ExperimentDeviceSeriesPanel } from "./experiment-device-series-panel";

vi.mock("@repo/ui/components/charts/bar-chart", () => ({
  BarChart: vi.fn(({ data }: { data: { y: number[] }[] }) => (
    <div data-testid="bar-chart" data-counts={data[0].y.join(",")} />
  )),
}));

const EXPERIMENT_ID = "11111111-1111-4111-8111-111111111111";
const WINDOW = { from: "2026-09-01T00:00:00.000Z", to: "2026-09-04T00:00:00.000Z" };

function renderPanel() {
  return render(
    <ExperimentDeviceSeriesPanel
      experimentId={EXPERIMENT_ID}
      clientId="AMBYTE_A"
      window={WINDOW}
    />,
  );
}

describe("ExperimentDeviceSeriesPanel", () => {
  it("plots the returned buckets, zero-filling the days that carried nothing", async () => {
    server.mount(contract.experiments.getExperimentDeviceSeries, {
      body: {
        buckets: [
          { bucketStart: "2026-09-01T00:00:00.000Z", count: 12 },
          { bucketStart: "2026-09-03T00:00:00.000Z", count: 4 },
        ],
        pipelineUnavailable: false,
      },
    });

    renderPanel();

    const chart = await screen.findByTestId("bar-chart");
    // The silent second of September is a real gap, not a missing point.
    expect(chart).toHaveAttribute("data-counts", "12,0,4,0");
  });

  it("says so when the warehouse could not be reached, rather than drawing zeroes", async () => {
    server.mount(contract.experiments.getExperimentDeviceSeries, {
      body: { buckets: [], pipelineUnavailable: true },
    });

    renderPanel();

    expect(await screen.findByText("iot.experimentDevices.chartUnavailable")).toBeInTheDocument();
    expect(screen.queryByTestId("bar-chart")).not.toBeInTheDocument();
  });

  it("distinguishes a genuinely empty window from an unavailable one", async () => {
    server.mount(contract.experiments.getExperimentDeviceSeries, {
      body: { buckets: [], pipelineUnavailable: false },
    });

    renderPanel();

    expect(await screen.findByText("iot.experimentDevices.chartEmpty")).toBeInTheDocument();
  });

  it("asks for the device it was given, over the window it was given", async () => {
    const spy = server.mount(contract.experiments.getExperimentDeviceSeries, {
      body: { buckets: [], pipelineUnavailable: false },
    });

    renderPanel();

    await screen.findByText("iot.experimentDevices.chartEmpty");
    expect(spy.calls[0].query).toMatchObject({
      clientId: "AMBYTE_A",
      from: WINDOW.from,
      to: WINDOW.to,
      bucket: "day",
    });
  });
});
