import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { LineChartProps } from "@repo/ui/components/charts/line-chart";

import { ActivitySparkline } from "./activity-sparkline";

vi.mock("@repo/ui/components/charts/line-chart", () => ({
  LineChart: ({ data, config, className }: LineChartProps) => (
    <div
      data-testid="line-chart"
      data-classname={className}
      data-x={JSON.stringify(data[0]?.x ?? [])}
      data-y={JSON.stringify(data[0]?.y ?? [])}
      data-name={data[0]?.name}
      data-color={data[0]?.color}
      data-sparkline={String(config?.sparkline)}
      data-mode-bar={String(config?.showModeBar)}
      data-legend={String(config?.showLegend)}
      data-grid={String(config?.showGrid)}
      data-background={config?.backgroundColor}
    />
  ),
}));

const days = [
  { date: "2026-08-26", measurements: 0 },
  { date: "2026-08-27", measurements: 5 },
  { date: "2026-08-28", measurements: 100 },
];

function renderSparkline() {
  render(
    <ActivitySparkline
      days={days}
      seriesName="Daily measurements"
      label="Daily measurements over 30 days"
      locale="en-US"
    />,
  );
  return screen.getByTestId("line-chart");
}

describe("ActivitySparkline", () => {
  it("plots one point per day", () => {
    const chart = renderSparkline();

    expect(chart).toHaveAttribute("data-x", '["2026-08-26","2026-08-27","2026-08-28"]');
    expect(chart).toHaveAttribute("data-y", "[0,5,100]");
    expect(chart).toHaveAttribute("data-name", "Daily measurements");
  });

  it("comes out as a strip, not a chart", () => {
    const chart = renderSparkline();

    expect(chart).toHaveAttribute("data-sparkline", "true");
    expect(chart).toHaveAttribute("data-mode-bar", "false");
    expect(chart).toHaveAttribute("data-legend", "false");
    expect(chart).toHaveAttribute("data-grid", "false");
    // Transparent, because it sits on a card rather than on its own surface.
    expect(chart).toHaveAttribute("data-background", "rgba(0,0,0,0)");
    // The 40px slot is on the labelled wrapper; the plot fills it.
    expect(screen.getByRole("img")).toHaveClass("h-10", "w-full");
    expect(chart).toHaveAttribute("data-classname", "h-full w-full");
  });

  it("describes itself for readers who cannot see it", () => {
    renderSparkline();

    expect(
      screen.getByRole("img", { name: "Daily measurements over 30 days" }),
    ).toBeInTheDocument();
  });

  it("takes its colour from the platform colorway rather than a literal", () => {
    // jsdom resolves no tokens, so this is the colorway's SSR fallback head.
    expect(renderSparkline()).toHaveAttribute("data-color", "#005E5E");
  });
});
