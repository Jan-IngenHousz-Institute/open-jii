import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { TrendSparkline } from "./trend-sparkline";

const days = [
  { date: "2026-10-01", measurements: 4 },
  { date: "2026-10-02", measurements: 1200 },
  { date: "2026-10-03", measurements: 0 },
];

describe("TrendSparkline", () => {
  it("draws a track and a bar for every day, with the peak day at full strength", () => {
    render(
      <TrendSparkline
        days={days}
        mark="bars"
        peakDate="2026-10-02"
        seriesName="Measurements"
        locale="en-US"
      />,
    );

    const svg = screen.getByRole("img", { name: "Measurements" });
    const bars = Array.from(svg.querySelectorAll("g > rect:nth-child(2)"));

    expect(svg.querySelectorAll("g")).toHaveLength(3);
    expect(bars.map((bar) => bar.getAttribute("opacity"))).toEqual(["0.45", "1", "0.45"]);
    expect(bars.map((bar) => bar.getAttribute("height"))).toEqual([
      "0.13333333333333333",
      "40",
      "0",
    ]);
  });

  it("draws a filled line through every day", () => {
    render(
      <TrendSparkline
        days={days}
        mark="line"
        peakDate={null}
        seriesName="Measurements"
        locale="en-US"
      />,
    );

    const paths = screen.getByRole("img", { name: "Measurements" }).querySelectorAll("path");

    expect(paths).toHaveLength(2);
    expect(paths.item(1).getAttribute("d")).toBe("M 0,39.86666666666667 L 50,0 L 100,40");
  });

  it("draws nothing for an empty window, rather than an invalid path", () => {
    render(
      <TrendSparkline
        days={[]}
        mark="line"
        peakDate={null}
        seriesName="Measurements"
        locale="en-US"
      />,
    );

    expect(screen.getByRole("img", { name: "Measurements" }).querySelectorAll("path")).toHaveLength(
      0,
    );
  });

  it("shows a day's date and total on hover", async () => {
    const user = userEvent.setup();
    render(
      <TrendSparkline
        days={days}
        mark="bars"
        peakDate={null}
        seriesName="Measurements"
        locale="en-US"
      />,
    );

    const targets = screen
      .getByRole("img", { name: "Measurements" })
      .querySelectorAll(":scope > rect");
    await user.hover(targets.item(1));

    expect((await screen.findAllByText("Oct 2, 2026: 1,200"))[0]).toBeInTheDocument();
  });
});
