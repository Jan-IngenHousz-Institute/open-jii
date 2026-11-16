import { LineChart } from "@/components/charts/line-chart";
import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { DeviceMonitoring } from "@repo/api/domains/iot/iot.schema";

import { BatteryPanel } from "./battery-panel";

vi.mock("@/components/charts/line-chart", () => ({
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
      macroMix: [],
    },
    firmwareHistory: [],
    recentMeasurements: [],
  };
}

describe("BatteryPanel", () => {
  it("explains an empty range", () => {
    render(<BatteryPanel monitoring={monitoringWith([])} />);
    expect(screen.getByText("iot.devices.monitoring.batteryUnavailable")).toBeInTheDocument();
  });

  it("explains an all-null range", () => {
    render(
      <BatteryPanel
        monitoring={monitoringWith([
          { bucketStart: "2026-08-13T01:00:00.000Z", averageBattery: null },
        ])}
      />,
    );

    expect(screen.getByText("iot.devices.monitoring.batteryUnavailable")).toBeInTheDocument();
  });

  it("keeps middle and trailing nulls in the chart and latest summary", () => {
    render(
      <BatteryPanel
        monitoring={monitoringWith(
          [3.8, null, 3.5, null].map((averageBattery, i) => ({
            bucketStart: `2026-08-13T0${i}:00:00.000Z`,
            averageBattery,
          })),
        )}
      />,
    );
    expect(vi.mocked(LineChart).mock.lastCall?.[0].data[0].y).toEqual([3.8, null, 3.5, null]);
    expect(
      screen.getByText("iot.devices.monitoring.batteryFinalMean").parentElement,
    ).toHaveTextContent("iot.devices.monitoring.batteryMissing");
  });

  it("adds empty buckets at both ends and between observations", () => {
    render(
      <BatteryPanel
        from="2026-08-13T00:00:00Z"
        to="2026-08-13T04:59:59Z"
        monitoring={monitoringWith([
          { bucketStart: "2026-08-13T03:00:00.000Z", averageBattery: 3.5 },
          { bucketStart: "2026-08-13T01:00:00.000Z", averageBattery: 3.8 },
        ])}
      />,
    );
    const series = vi.mocked(LineChart).mock.lastCall?.[0].data[0];
    expect(series?.y).toEqual([null, 3.8, null, 3.5, null]);
    expect(series?.connectgaps).toBe(false);
    expect(series?.x).toHaveLength(5);
  });

  it("does not present a bucket average as the newest missing report", () => {
    render(
      <BatteryPanel
        from="2026-08-13T00:00:00Z"
        to="2026-08-13T04:59:59Z"
        monitoring={monitoringWith([
          {
            bucketStart: "2026-08-13T01:00:00.000Z",
            averageBattery: 3.8,
            latestAt: "2026-08-13T01:55:00Z",
            latestBattery: null,
            lastReportedAt: "2026-08-13T01:15:00Z",
            reportedCount: 1,
            sampleCount: 2,
          },
        ])}
      />,
    );
    expect(
      screen.getByText("iot.devices.monitoring.batteryLatest").parentElement,
    ).toHaveTextContent("iot.devices.monitoring.batteryMissing");
    expect(
      screen.getByText("iot.devices.monitoring.batteryLastReport").parentElement,
    ).toHaveTextContent(new Date("2026-08-13T01:15:00Z").toLocaleString("en-US"));
    expect(screen.getByText("iot.devices.monitoring.batteryProvenance")).toBeInTheDocument();
  });

  it("keeps the newest received report when later axis buckets have no messages", () => {
    render(
      <BatteryPanel
        from="2026-08-13T00:00:00Z"
        to="2026-08-13T04:59:59Z"
        monitoring={monitoringWith([
          {
            bucketStart: "2026-08-13T01:00:00Z",
            averageBattery: 3.75,
            latestBattery: 3.8,
            sampleCount: 2,
            reportedCount: 2,
          },
          {
            bucketStart: "2026-08-13T03:00:00Z",
            averageBattery: null,
            latestBattery: null,
            sampleCount: 0,
            reportedCount: 0,
          },
        ])}
      />,
    );
    expect(
      screen.getByText("iot.devices.monitoring.batteryLatest").parentElement,
    ).toHaveTextContent("3.80");
    expect(vi.mocked(LineChart).mock.lastCall?.[0].data[0].y).toEqual([
      null,
      3.75,
      null,
      null,
      null,
    ]);
  });

  it("labels the newest received legacy mean when the requested range continues", () => {
    render(
      <BatteryPanel
        from="2026-08-13T00:00:00Z"
        to="2026-08-13T04:59:59Z"
        monitoring={monitoringWith([{ bucketStart: "2026-08-13T01:00:00Z", averageBattery: 85 }])}
      />,
    );
    expect(
      screen.getByText("iot.devices.monitoring.batteryFinalMean").parentElement,
    ).toHaveTextContent("85.00");
  });

  it("charts the series with a table view behind the toggle", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <BatteryPanel
        monitoring={monitoringWith([
          { bucketStart: "2026-08-13T01:00:00.000Z", averageBattery: 87.5 },
          { bucketStart: "2026-08-13T02:00:00.000Z", averageBattery: null },
        ])}
      />,
    );

    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    // The latest reading also shows as a summary figure above the chart.
    expect(screen.getByText("iot.devices.monitoring.batteryFinalMean")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("min-w-0");
    expect(
      screen.getByText("iot.devices.monitoring.batteryFinalMean").parentElement?.parentElement,
    ).toHaveClass("flex-wrap");

    await user.click(screen.getByRole("radio", { name: "iot.devices.monitoring.viewTable" }));
    expect(
      screen.getByRole("columnheader", { name: "iot.devices.monitoring.batteryTimeAxis" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("table")).toHaveTextContent("Aug 13, 01:00 AM");

    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText("87.50")).toBeInTheDocument();
  });
});
