import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { ExperimentDataTableChartCell } from "./experiment-data-table-chart-cell";

describe("ExperimentDataTableChartCell", () => {
  const mockColumnName = "test_column";
  const mockData = [1, 2, 3, 4, 5];
  const mockStringData = "[1,2,3,4,5]";

  it("renders chart cell with SVG when data is provided as array", () => {
    render(<ExperimentDataTableChartCell data={mockData} columnName={mockColumnName} />);

    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg?.tagName).toBe("svg");
  });

  it("renders chart cell with SVG when data is provided as string", () => {
    render(<ExperimentDataTableChartCell data={mockStringData} columnName={mockColumnName} />);

    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders 'No data' message when data array is empty", () => {
    render(<ExperimentDataTableChartCell data={[]} columnName={mockColumnName} />);

    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("renders 'No data' message when string data is empty", () => {
    render(<ExperimentDataTableChartCell data="[]" columnName={mockColumnName} />);

    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("scrolls to experiment-data-chart when clicked", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Mock scrollIntoView
    const mockScrollIntoView = vi.fn();
    const mockGetElementById = vi.spyOn(document, "getElementById");
    const mockElement = {
      scrollIntoView: mockScrollIntoView,
    } as unknown as HTMLElement;
    mockGetElementById.mockReturnValue(mockElement);

    render(<ExperimentDataTableChartCell data={mockData} columnName={mockColumnName} />);

    const chartContainer = document.querySelector("svg")?.parentElement;
    if (chartContainer) {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
      await user.click(chartContainer);
    }

    // Fast-forward time to trigger setTimeout
    vi.advanceTimersByTime(100);

    // Verify getElementById was called with the correct ID
    expect(mockGetElementById).toHaveBeenCalledWith("experiment-data-chart");

    // Verify scrollIntoView was called with correct options
    expect(mockScrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });

    mockGetElementById.mockRestore();
    vi.useRealTimers();
  });

  it("handles missing chart container gracefully on click", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const mockGetElementById = vi.spyOn(document, "getElementById");
    mockGetElementById.mockReturnValue(null);

    // Should not throw error
    render(<ExperimentDataTableChartCell data={mockData} columnName={mockColumnName} />);

    const chartContainer = document.querySelector("svg")?.parentElement;
    if (chartContainer) {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
      await user.click(chartContainer);
    }

    // Fast-forward time to trigger setTimeout
    vi.advanceTimersByTime(100);

    // Verify getElementById was called but no error was thrown
    expect(mockGetElementById).toHaveBeenCalledWith("experiment-data-chart");

    mockGetElementById.mockRestore();
    vi.useRealTimers();
  });

  it("does not scroll when clicking on empty data", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const mockGetElementById = vi.spyOn(document, "getElementById");

    render(<ExperimentDataTableChartCell data={[]} columnName={mockColumnName} />);

    const noDataElement = screen.getByText("No data");
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    await user.click(noDataElement);

    // Should not attempt to scroll
    expect(mockGetElementById).not.toHaveBeenCalled();

    mockGetElementById.mockRestore();
    vi.useRealTimers();
  });

  it("parses JSON string data correctly", () => {
    render(<ExperimentDataTableChartCell data="[1.5, 2.7, 3.9]" columnName={mockColumnName} />);

    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("parses comma-separated string data correctly", () => {
    render(<ExperimentDataTableChartCell data="1.1,2.2,3.3" columnName={mockColumnName} />);

    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("filters out NaN values from parsed data", () => {
    render(<ExperimentDataTableChartCell data="1,invalid,3,NaN,5" columnName={mockColumnName} />);

    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("handles malformed JSON gracefully", () => {
    render(
      <ExperimentDataTableChartCell
        data="invalid-data-that-cannot-be-parsed-[{"
        columnName={mockColumnName}
      />,
    );

    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("generates correct SVG path for data points", () => {
    render(<ExperimentDataTableChartCell data={[0, 5, 10]} columnName={mockColumnName} />);

    const path = document.querySelector("svg")?.querySelector("path");
    expect(path).toBeInTheDocument();
    expect(path?.getAttribute("d")).toMatch(/^M \d+,\d+ L \d+,\d+ L \d+,\d+$/);
  });

  it("applies correct CSS classes for styling", () => {
    render(<ExperimentDataTableChartCell data={mockData} columnName={mockColumnName} />);

    const chartContainer = document.querySelector("svg")?.parentElement;
    expect(chartContainer).toHaveClass("hover:bg-muted/30");
    expect(chartContainer).toHaveClass("cursor-pointer");
    expect(chartContainer).toHaveClass("relative");
  });
});
