import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ActivityStrip } from "./activity-strip";

const days = [
  { date: "2026-08-26", measurements: 0 },
  { date: "2026-08-27", measurements: 5 },
  { date: "2026-08-28", measurements: 100 },
];

describe("ActivityStrip", () => {
  it("draws one cell per day, banded against the busiest", () => {
    const { container } = render(<ActivityStrip days={days} label="Activity" />);

    const cells = container.querySelectorAll("rect");
    expect(cells).toHaveLength(3);
    expect(cells[0]).toHaveClass("fill-muted");
    expect(cells[2]).toHaveClass("fill-primary");
    // The busiest day sits at full strength, a quiet one stays visible.
    expect(cells[2].getAttribute("opacity")).toBe("1");
    expect(Number(cells[1].getAttribute("opacity"))).toBeGreaterThan(0);
  });

  it("describes itself for readers who cannot see it", () => {
    render(<ActivityStrip days={days} label="Measurements over 30 days" />);

    expect(screen.getByRole("img", { name: "Measurements over 30 days" })).toBeInTheDocument();
  });

  it("renders nothing without days", () => {
    const { container } = render(<ActivityStrip days={[]} label="Activity" />);

    expect(container).toBeEmptyDOMElement();
  });
});
