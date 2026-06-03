import { render, userEvent, within } from "@/test/test-utils";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

import { ExperimentDataTableChartCell } from "./experiment-data-table-chart-cell";

const mockColumnName = "test_column";
const mockData = [1, 2, 3, 4, 5];

// Scope every DOM query to the render's container; `isolate: false` leaves
// other files' SVGs/icons in document.body so a global `document.querySelector`
// can pick up the wrong element.
function renderCell(props: Parameters<typeof ExperimentDataTableChartCell>[0]) {
  const result = render(<ExperimentDataTableChartCell {...props} />);
  const root = result.container.firstChild;
  if (!(root instanceof HTMLElement)) throw new Error("expected a root element");
  return { ...result, scoped: within(root), root };
}

describe("ExperimentDataTableChartCell", () => {
  it("renders an SVG when data is an array of numbers", () => {
    const { root } = renderCell({ data: mockData, columnName: mockColumnName });
    expect(root.querySelector("svg")).toBeInTheDocument();
  });

  it("renders an SVG when data is a JSON-array string", () => {
    const { root } = renderCell({ data: "[1,2,3,4,5]", columnName: mockColumnName });
    expect(root.querySelector("svg")).toBeInTheDocument();
  });

  it("shows 'No data' when the array is empty", () => {
    const { scoped } = renderCell({ data: [], columnName: mockColumnName });
    expect(scoped.getByText("No data")).toBeInTheDocument();
  });

  it("shows 'No data' when the string represents an empty array", () => {
    const { scoped } = renderCell({ data: "[]", columnName: mockColumnName });
    expect(scoped.getByText("No data")).toBeInTheDocument();
  });

  it("parses a JSON-array string into rendered points", () => {
    const { root } = renderCell({ data: "[1.5, 2.7, 3.9]", columnName: mockColumnName });
    expect(root.querySelector("svg path")).toBeInTheDocument();
  });

  it("parses a comma-separated string into rendered points", () => {
    const { root } = renderCell({ data: "1.1,2.2,3.3", columnName: mockColumnName });
    expect(root.querySelector("svg path")).toBeInTheDocument();
  });

  it("filters out NaN tokens from a comma-separated string", () => {
    const { root } = renderCell({ data: "1,invalid,3,NaN,5", columnName: mockColumnName });
    expect(root.querySelector("svg path")).toBeInTheDocument();
  });

  it("falls back to 'No data' when the string is unparseable", () => {
    const { scoped } = renderCell({
      data: "invalid-data-that-cannot-be-parsed-[{",
      columnName: mockColumnName,
    });
    expect(scoped.getByText("No data")).toBeInTheDocument();
  });

  it("generates a polyline-style SVG path from the data points", () => {
    const { root } = renderCell({ data: [0, 5, 10], columnName: mockColumnName });
    const path = root.querySelector("svg path");
    expect(path).toBeInTheDocument();
    expect(path?.getAttribute("d")).toMatch(
      /^M \d+,\d+(\.\d+)? L \d+,\d+(\.\d+)? L \d+,\d+(\.\d+)?$/,
    );
  });

  it("applies hover/cursor classes to the chart cell wrapper", () => {
    const { root } = renderCell({ data: mockData, columnName: mockColumnName });
    expect(root).toHaveClass("hover:bg-muted/30");
    expect(root).toHaveClass("cursor-pointer");
    expect(root).toHaveClass("relative");
  });

  describe("click → scrollIntoView", () => {
    // Real DOM element with the id the component reads; scrollIntoView is
    // globally stubbed in setup.ts so we assert against its call args.
    let chartTarget: HTMLDivElement;

    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      chartTarget = document.createElement("div");
      chartTarget.id = "experiment-data-chart";
      document.body.appendChild(chartTarget);
    });

    afterEach(() => {
      chartTarget.remove();
      vi.useRealTimers();
    });

    it("scrolls the chart into view on click", async () => {
      const { root } = renderCell({ data: mockData, columnName: mockColumnName });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
      await user.click(root);
      vi.advanceTimersByTime(100);

      expect(chartTarget.scrollIntoView).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
      });
    });

    it("doesn't scroll when the cell is the empty-state branch", async () => {
      const { scoped } = renderCell({ data: [], columnName: mockColumnName });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
      await user.click(scoped.getByText("No data"));
      vi.advanceTimersByTime(100);

      expect(chartTarget.scrollIntoView).not.toHaveBeenCalled();
    });
  });
});
