import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { ExperimentDataTableChartCell } from "../experiment-data-table-chart-cell";

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

  it("calls onHover when mouse enters the chart", () => {
    const mockOnHover = vi.fn();

    render(
      <ExperimentDataTableChartCell
        data={mockData}
        columnName={mockColumnName}
        onHover={mockOnHover}
      />,
    );

    const chartContainer = document.querySelector("svg")?.parentElement;
    if (chartContainer) {
      fireEvent.mouseEnter(chartContainer);
    }

    expect(mockOnHover).toHaveBeenCalledWith(mockData, mockColumnName);
  });

  it("calls onLeave when mouse leaves the chart", () => {
    const mockOnLeave = vi.fn();

    render(
      <ExperimentDataTableChartCell
        data={mockData}
        columnName={mockColumnName}
        onLeave={mockOnLeave}
      />,
    );

    const chartContainer = document.querySelector("svg")?.parentElement;
    if (chartContainer) {
      fireEvent.mouseLeave(chartContainer);
    }

    expect(mockOnLeave).toHaveBeenCalled();
  });

  it("calls onClick when chart is clicked", () => {
    const mockOnClick = vi.fn();

    render(
      <ExperimentDataTableChartCell
        data={mockData}
        columnName={mockColumnName}
        onClick={mockOnClick}
      />,
    );

    const chartContainer = document.querySelector("svg")?.parentElement;
    if (chartContainer) {
      fireEvent.click(chartContainer);
    }

    expect(mockOnClick).toHaveBeenCalledWith(mockData, mockColumnName);
  });

  it("does not call handlers when data is empty", () => {
    const mockOnHover = vi.fn();
    const mockOnClick = vi.fn();

    render(
      <ExperimentDataTableChartCell
        data={[]}
        columnName={mockColumnName}
        onHover={mockOnHover}
        onClick={mockOnClick}
      />,
    );

    const noDataElement = screen.getByText("No data");
    fireEvent.mouseEnter(noDataElement);
    fireEvent.click(noDataElement);

    expect(mockOnHover).not.toHaveBeenCalled();
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it("parses JSON string data correctly", () => {
    const mockOnHover = vi.fn();

    render(
      <ExperimentDataTableChartCell
        data="[1.5, 2.7, 3.9]"
        columnName={mockColumnName}
        onHover={mockOnHover}
      />,
    );

    const chartContainer = document.querySelector("svg").parentElement;
    if (chartContainer) {
      fireEvent.mouseEnter(chartContainer);
    }

    expect(mockOnHover).toHaveBeenCalledWith([1.5, 2.7, 3.9], mockColumnName);
  });

  it("parses comma-separated string data correctly", () => {
    const mockOnHover = vi.fn();

    render(
      <ExperimentDataTableChartCell
        data="1.1,2.2,3.3"
        columnName={mockColumnName}
        onHover={mockOnHover}
      />,
    );

    const chartContainer = document.querySelector("svg").parentElement;
    if (chartContainer) {
      fireEvent.mouseEnter(chartContainer);
    }

    expect(mockOnHover).toHaveBeenCalledWith([1.1, 2.2, 3.3], mockColumnName);
  });

  it("filters out NaN values from parsed data", () => {
    const mockOnHover = vi.fn();

    render(
      <ExperimentDataTableChartCell
        data="1,invalid,3,NaN,5"
        columnName={mockColumnName}
        onHover={mockOnHover}
      />,
    );

    const chartContainer = document.querySelector("svg").parentElement;
    if (chartContainer) {
      fireEvent.mouseEnter(chartContainer);
    }

    expect(mockOnHover).toHaveBeenCalledWith([1, 3, 5], mockColumnName);
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
    expect(chartContainer).toHaveClass("hover:bg-muted/50");
    expect(chartContainer).toHaveClass("cursor-pointer");
    expect(chartContainer).toHaveClass("relative");
  });
});
