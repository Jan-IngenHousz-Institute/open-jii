import { render, screen, userEvent } from "@/test/test-utils";
import { formatTimestamp } from "@/util/date";
import { describe, expect, it, vi } from "vitest";

import type { MonitoringRange } from "../monitoring/monitoring-range";
import { GroupThroughputPanel } from "./group-throughput-panel";

vi.mock("@repo/ui/components/charts/bar-chart", () => ({
  BarChart: vi.fn(({ data }: { data: { name: string }[] }) => (
    <div data-testid="bar-chart">{JSON.stringify(data.map((series) => series.name))}</div>
  )),
}));

const DEVICE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DEVICE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BUCKET = "2026-08-13T01:00:00.000Z";

const LABELS = new Map([
  [DEVICE_A, "Alpha"],
  [DEVICE_B, "Beta"],
]);

const RANGE: MonitoringRange = {
  from: "2026-08-13T00:00:00.000Z",
  to: "2026-08-13T02:00:00.000Z",
  bucket: "hour",
};

describe("GroupThroughputPanel", () => {
  it("names each member's series from the label map", () => {
    render(
      <GroupThroughputPanel
        throughput={[
          { bucketStart: BUCKET, deviceId: DEVICE_B, count: 5 },
          { bucketStart: BUCKET, deviceId: DEVICE_A, count: 3 },
        ]}
        labelByDeviceId={LABELS}
        range={RANGE}
        locale="en-US"
      />,
    );

    expect(screen.getByTestId("bar-chart").textContent).toBe('["Alpha","Beta"]');
    expect(screen.getByText("iot.devices.monitoring.throughputTotal")).toBeInTheDocument();
  });

  it("counts only bucketed rows, so bucketless data leaves the empty state", () => {
    render(
      <GroupThroughputPanel
        throughput={[{ bucketStart: null, deviceId: DEVICE_A, count: 5 }]}
        labelByDeviceId={LABELS}
        range={RANGE}
        locale="en-US"
      />,
    );

    expect(screen.getByText("iot.devices.monitoring.noMeasurements")).toBeInTheDocument();
    expect(screen.queryByTestId("bar-chart")).not.toBeInTheDocument();
  });

  it("shows the empty state without measurements", () => {
    render(
      <GroupThroughputPanel
        throughput={[]}
        labelByDeviceId={LABELS}
        range={RANGE}
        locale="en-US"
      />,
    );

    expect(screen.getByText("iot.devices.monitoring.noMeasurements")).toBeInTheDocument();
  });

  it("offers the same series as rows in the table view", async () => {
    const user = userEvent.setup();
    render(
      <GroupThroughputPanel
        throughput={[{ bucketStart: BUCKET, deviceId: DEVICE_A, count: 3 }]}
        labelByDeviceId={LABELS}
        range={RANGE}
        locale="en-US"
      />,
    );

    await user.click(screen.getByRole("radio", { name: "iot.devices.monitoring.viewTable" }));

    expect(screen.queryByTestId("bar-chart")).not.toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(formatTimestamp(BUCKET, "en-US"))).toBeInTheDocument();
  });
});
