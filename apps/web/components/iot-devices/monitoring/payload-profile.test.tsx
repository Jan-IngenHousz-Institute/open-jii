import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { DevicePayloadStats } from "@repo/api/domains/iot/iot.schema";

import { PayloadProfile } from "./payload-profile";

vi.mock("@repo/ui/components/charts/bar-chart", () => ({
  BarChart: vi.fn(({ data }: { data: { name: string }[] }) => (
    <div data-testid="share-bar">{data.map((series) => series.name).join(",")}</div>
  )),
}));

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
  it("reads coverage as a share of the measurements sent", () => {
    render(<PayloadProfile payload={payload()} />);

    expect(screen.getByText("25% (50/200)")).toBeInTheDocument();
    expect(screen.getByText("100% (200/200)")).toBeInTheDocument();
  });

  it("shows the headline counts for the window", () => {
    render(<PayloadProfile payload={payload()} />);

    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("says so plainly when the device sent nothing, instead of rendering empty charts", () => {
    render(<PayloadProfile payload={payload({ totalMeasurements: 0 })} />);

    expect(screen.getByText("iot.devices.monitoring.noMeasurements")).toBeInTheDocument();
    expect(screen.queryByTestId("share-bar")).not.toBeInTheDocument();
  });

  it("charts the firmware mix and reports an absent protocol mix as nothing reported", () => {
    render(<PayloadProfile payload={payload()} />);

    expect(screen.getByTestId("share-bar")).toHaveTextContent("1.1.0");
    expect(screen.getByText("iot.devices.monitoring.noBreakdown")).toBeInTheDocument();
  });

  it("charts the protocol mix when legacy-topic rows carry one", () => {
    render(
      <PayloadProfile payload={payload({ protocolMix: [{ protocolId: "proto-1", count: 12 }] })} />,
    );

    const bars = screen.getAllByTestId("share-bar");
    expect(bars.some((bar) => bar.textContent.includes("proto-1"))).toBe(true);
  });
});
