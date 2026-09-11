import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ActivityStrip } from "./activity-strip";

const days = [
  { date: "2026-08-26", measurements: 0 },
  { date: "2026-08-27", measurements: 5 },
  { date: "2026-08-28", measurements: 100 },
];

describe("ActivityStrip", () => {
  it("draws one point per day, scaled between the quietest and busiest", () => {
    const { container } = render(<ActivityStrip days={days} label="Activity" />);

    const path = container.querySelector("path")?.getAttribute("d") ?? "";
    const points = path.replace("M ", "").split(" L ");
    expect(points).toHaveLength(3);

    // SVG y grows downward, so the busiest day sits highest: smallest y.
    const yOf = (point: string) => Number(point.split(",")[1]);
    expect(yOf(points[2])).toBeLessThan(yOf(points[0]));
  });

  it("describes itself for readers who cannot see it", () => {
    render(<ActivityStrip days={days} label="Measurements over 30 days" />);

    expect(screen.getByRole("img", { name: "Measurements over 30 days" })).toBeInTheDocument();
  });

  it("draws a flat series along the baseline rather than dividing by zero", () => {
    const flat = days.map((day) => ({ ...day, measurements: 7 }));

    const { container } = render(<ActivityStrip days={flat} label="Activity" />);

    const path = container.querySelector("path")?.getAttribute("d");
    expect(path).toContain("31.0");
  });

  it("renders nothing when a single day cannot make a line", () => {
    const { container } = render(<ActivityStrip days={days.slice(0, 1)} label="Activity" />);

    expect(container).toBeEmptyDOMElement();
  });
});
