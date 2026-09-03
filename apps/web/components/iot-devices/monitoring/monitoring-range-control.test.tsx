import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { MonitoringRange } from "./monitoring-range";
import { MonitoringRangeControl } from "./monitoring-range-control";

const RANGE: MonitoringRange = {
  from: "2026-08-14T10:30:00.000Z",
  to: "2026-08-15T10:30:00.000Z",
  bucket: "hour",
};

describe("MonitoringRangeControl", () => {
  it("emits a resolved window and the preset that produced it", async () => {
    const onRangeChange = vi.fn();
    const user = userEvent.setup();

    render(
      <MonitoringRangeControl
        range={RANGE}
        activePreset="last24h"
        onRangeChange={onRangeChange}
        isUpdating={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "iot.devices.monitoring.range.last7d" }));

    const [range, preset] = onRangeChange.mock.calls[0] as [MonitoringRange, string];
    expect(preset).toBe("last7d");
    // A week cannot be read hourly, so the grain follows the span.
    expect(range.bucket).toBe("day");
    expect(new Date(range.to).getTime() - new Date(range.from).getTime()).toBe(7 * 86_400_000);
  });

  it("marks the active preset so the current window is obvious", () => {
    render(
      <MonitoringRangeControl
        range={RANGE}
        activePreset="last24h"
        onRangeChange={vi.fn()}
        isUpdating={false}
      />,
    );

    expect(
      screen.getByRole("button", { name: "iot.devices.monitoring.range.last24h" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "iot.devices.monitoring.range.last1h" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("shows the window bounds and the limit that applies to a custom one", async () => {
    const user = userEvent.setup();

    render(
      <MonitoringRangeControl
        range={RANGE}
        activePreset={null}
        onRangeChange={vi.fn()}
        isUpdating={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Aug 14/ }));

    expect(await screen.findByText("iot.devices.monitoring.rangeLimit")).toBeInTheDocument();
  });

  it("surfaces an in-flight refresh", () => {
    render(
      <MonitoringRangeControl
        range={RANGE}
        activePreset="last24h"
        onRangeChange={vi.fn()}
        isUpdating
      />,
    );

    expect(screen.getByText("iot.devices.monitoring.updating")).toBeInTheDocument();
  });
});
