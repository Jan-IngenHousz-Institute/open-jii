import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { DeviceMonitoring } from "@repo/api/domains/iot/iot.schema";

import { BatteryPanel } from "./battery-panel";

vi.mock("@repo/ui/components/charts/line-chart", () => ({
  LineChart: vi.fn(() => <div data-testid="line-chart" />),
}));

function monitoringWith(battery: DeviceMonitoring["battery"]): DeviceMonitoring {
  return {
    bucket: "hour",
    events: [],
    sessions: [],
    uptimePercent: null,
    truncated: false,
    throughput: [],
    battery,
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

describe("BatteryPanel", () => {
  it("renders nothing for a family that never reports battery", () => {
    const { container } = render(<BatteryPanel monitoring={monitoringWith([])} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("also renders nothing when every bucket's average is null", () => {
    const { container } = render(
      <BatteryPanel
        monitoring={monitoringWith([
          { bucketStart: "2026-08-13T01:00:00.000Z", averageBattery: null },
        ])}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("charts the series with a table view behind the toggle", async () => {
    const user = userEvent.setup();
    render(
      <BatteryPanel
        monitoring={monitoringWith([
          { bucketStart: "2026-08-13T01:00:00.000Z", averageBattery: 87.5 },
          { bucketStart: "2026-08-13T02:00:00.000Z", averageBattery: null },
        ])}
      />,
    );

    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    // The latest reading also shows as a summary figure above the chart.
    expect(screen.getByText("iot.devices.monitoring.batteryLatest")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "iot.devices.monitoring.viewTable" }));

    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getAllByText("87.50").length).toBeGreaterThan(1);
  });
});
