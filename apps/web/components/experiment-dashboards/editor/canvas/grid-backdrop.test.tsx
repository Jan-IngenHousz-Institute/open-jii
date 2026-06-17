import { render } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { DashboardFormValues } from "../../dashboard-form-shell";
import type { CanvasBounds } from "./grid-backdrop";
import { GridBackdrop } from "./grid-backdrop";

const baseBounds: CanvasBounds = {
  canvasLeft: 16,
  canvasTop: 8,
  canvasWidth: 800,
  gradientWidth: 1000,
  gradientHeight: 600,
};

const baseLayout: DashboardFormValues["layout"] = {
  columns: 12,
  rowHeight: 80,
  gap: 16,
};

describe("GridBackdrop", () => {
  it("renders nothing when canvas width is zero (pre-measure)", () => {
    const { container } = render(
      <GridBackdrop bounds={{ ...baseBounds, canvasWidth: 0 }} layout={baseLayout} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders an aria-hidden overlay anchored to the canvas", () => {
    const { container } = render(<GridBackdrop bounds={baseBounds} layout={baseLayout} />);
    const overlay = container.querySelector("[aria-hidden='true']");
    expect(overlay).not.toBeNull();
    expect(overlay).toHaveClass("pointer-events-none");
  });

  it("emits paired vertical lines for each grid column plus bleed on both sides", () => {
    const { container } = render(<GridBackdrop bounds={baseBounds} layout={baseLayout} />);
    const verticals = container.querySelectorAll(".w-px");
    expect(verticals.length).toBeGreaterThan(baseLayout.columns * 2);
    expect(verticals.length % 2).toBe(0);
  });

  it("emits at least one row pair of horizontal lines when the canvas has height", () => {
    const { container } = render(<GridBackdrop bounds={baseBounds} layout={baseLayout} />);
    const horizontals = container.querySelectorAll(".h-px");
    expect(horizontals.length).toBeGreaterThanOrEqual(2);
    expect(horizontals.length % 2).toBe(0);
  });

  it("emits no horizontal lines when the gradient sits at or above the canvas top", () => {
    const { container } = render(
      <GridBackdrop
        bounds={{ ...baseBounds, canvasTop: baseBounds.gradientHeight }}
        layout={baseLayout}
      />,
    );
    expect(container.querySelectorAll(".h-px")).toHaveLength(0);
  });

  it("scales the column line count with the layout column count", () => {
    const { container: c12 } = render(<GridBackdrop bounds={baseBounds} layout={baseLayout} />);
    const { container: c4 } = render(
      <GridBackdrop bounds={baseBounds} layout={{ ...baseLayout, columns: 4 }} />,
    );
    expect(c12.querySelectorAll(".w-px").length).toBeGreaterThan(
      c4.querySelectorAll(".w-px").length,
    );
  });
});
