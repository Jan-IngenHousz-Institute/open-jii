/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import {
  formatValue,
  LoadingRows,
  ExperimentTableHeader,
  ExperimentDataRows,
} from "./experiment-data-utils";

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "experimentDataTable.noResults": "No results found",
        "experimentDataTable.loading": "Loading...",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock @tanstack/react-table
vi.mock("@tanstack/react-table", () => ({
  flexRender: vi.fn((component: unknown, context: unknown) => {
    if (typeof component === "function") {
      return (component as (ctx: unknown) => React.ReactNode)(context);
    }
    return component as React.ReactNode;
  }),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  ChevronDown: () => <div data-testid="chevron-down">▼</div>,
  ChevronRight: () => <div data-testid="chevron-right">▶</div>,
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
  TableCell: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    colSpan?: number;
    className?: string;
    style?: React.CSSProperties;
  }) => <td {...props}>{children}</td>,
  TableRow: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    "data-state"?: string;
    className?: string;
  }) => <tr {...props}>{children}</tr>,
  TableHead: ({
    children,
    className,
    style,
  }: {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
  }) => (
    <th className={className} style={style}>
      {children}
    </th>
  ),
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  Collapsible: ({
    children,
    open,
    onOpenChange: _onOpenChange,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <div data-testid="collapsible" data-open={open}>
      {children}
    </div>
  ),
  CollapsibleTrigger: ({
    children,
    asChild: _asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <div data-testid="collapsible-trigger">{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="collapsible-content">{children}</div>
  ),
  Button: ({
    children,
    variant: _variant,
    size: _size,
    className,
    onClick,
  }: {
    children: React.ReactNode;
    variant?: string;
    size?: string;
    className?: string;
    onClick?: () => void;
  }) => (
    <button className={className} onClick={onClick} data-testid="button">
      {children}
    </button>
  ),
}));

describe("experiment-data-utils", () => {
  describe("formatValue", () => {
    it("should format numeric values with right alignment", () => {
      const result = formatValue(123.45, "DOUBLE");
      expect(result).toEqual(<div className="text-right tabular-nums">{123.45}</div>);
    });

    it("should format INT values with right alignment", () => {
      const result = formatValue(42, "INT");
      expect(result).toEqual(<div className="text-right tabular-nums">{42}</div>);
    });

    it("should format LONG values with right alignment", () => {
      const result = formatValue(1234567890, "LONG");
      expect(result).toEqual(<div className="text-right tabular-nums">{1234567890}</div>);
    });

    it("should format BIGINT values with right alignment", () => {
      const result = formatValue(9876543210, "BIGINT");
      expect(result).toEqual(<div className="text-right tabular-nums">{9876543210}</div>);
    });

    it("should format TIMESTAMP values by truncating and replacing T", () => {
      const result = formatValue("2023-01-01T10:30:45.123Z", "TIMESTAMP");
      expect(result).toBe("2023-01-01 10:30:45");
    });

    it("should return string values as-is for other types", () => {
      const result = formatValue("test string", "STRING");
      expect(result).toBe("test string");
    });

    it("should handle null values", () => {
      const result = formatValue(null, "STRING");
      expect(result).toBeNull();
    });

    it("should render ExperimentDataTableMapCell for MAP type", () => {
      const result = formatValue('{"key": "value"}', "MAP", "test-column");

      // The result should be a React element (ExperimentDataTableMapCell)
      expect(React.isValidElement(result)).toBe(true);

      // Render it to check the component
      render(<div>{result}</div>);
      expect(screen.getByText("key:")).toBeInTheDocument();
      expect(screen.getByText("value")).toBeInTheDocument();
    });

    it("should render ExperimentDataTableMapCell for MAP<STRING,STRING> type", () => {
      const result = formatValue(
        '{"name": "John", "role": "Admin"}',
        "MAP<STRING,STRING>",
        "test-column",
      );

      // The result should be a React element (ExperimentDataTableMapCell)
      expect(React.isValidElement(result)).toBe(true);

      // Render it to check the component
      render(<div>{result}</div>);
      expect(screen.getByText("2 entries")).toBeInTheDocument();
    });

    it("should render ExperimentDataTableMapCell for MAP<STRING,INT> type", () => {
      const result = formatValue('{"count": 5, "total": 10}', "MAP<STRING,INT>", "test-column");

      // The result should be a React element (ExperimentDataTableMapCell)
      expect(React.isValidElement(result)).toBe(true);

      // Render it to check the component
      render(<div>{result}</div>);
      expect(screen.getByText("2 entries")).toBeInTheDocument();
    });
  });

  describe("LoadingRows", () => {
    it("should render loading message and skeleton rows", () => {
      render(
        <table>
          <tbody>
            <LoadingRows rowCount={3} columnCount={2} />
          </tbody>
        </table>,
      );

      expect(screen.getByText("Loading...")).toBeInTheDocument();

      // Should render 2 skeleton rows (rowCount - 1, since first row shows loading message)
      const skeletons = screen.getAllByTestId("skeleton");
      expect(skeletons).toHaveLength(4); // 2 rows × 2 columns
    });

    it("should render correct number of skeleton cells", () => {
      render(
        <table>
          <tbody>
            <LoadingRows rowCount={2} columnCount={3} />
          </tbody>
        </table>,
      );

      // Should render 1 skeleton row (rowCount - 1) with 3 columns
      const skeletons = screen.getAllByTestId("skeleton");
      expect(skeletons).toHaveLength(3); // 1 row × 3 columns
    });
  });

  describe("ExperimentTableHeader", () => {
    it("should render table headers with correct alignment for numeric columns", () => {
      const mockHeaderGroups = [
        {
          id: "headerGroup1",
          depth: 0,
          headers: [
            {
              id: "header1",
              column: {
                columnDef: {
                  header: "Name",
                  size: 150,
                  meta: { type: "STRING" },
                },
              },
              isPlaceholder: false,
              getContext: () => ({}),
            },
            {
              id: "header2",
              column: {
                columnDef: {
                  header: "Value",
                  size: 100,
                  meta: { type: "DOUBLE" },
                },
              },
              isPlaceholder: false,
              getContext: () => ({}),
            },
            {
              id: "header3",
              column: {
                columnDef: {
                  header: "Count",
                  size: 80,
                  meta: { type: "INT" },
                },
              },
              isPlaceholder: false,
              getContext: () => ({}),
            },
          ],
        },
      ] as any;

      render(
        <table>
          <ExperimentTableHeader headerGroups={mockHeaderGroups} />
        </table>,
      );

      // Check that headers are rendered
      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("Value")).toBeInTheDocument();
      expect(screen.getByText("Count")).toBeInTheDocument();

      // Check alignment classes
      const nameHeader = screen.getByText("Name").closest("th");
      const valueHeader = screen.getByText("Value").closest("th");
      const countHeader = screen.getByText("Count").closest("th");

      expect(nameHeader).toHaveClass("text-left");
      expect(valueHeader).toHaveClass("text-right");
      expect(countHeader).toHaveClass("text-right");

      // Check styles
      expect(nameHeader).toHaveStyle({ minWidth: "150px" });
      expect(valueHeader).toHaveStyle({ minWidth: "100px" });
      expect(countHeader).toHaveStyle({ minWidth: "80px" });
    });

    it("should handle numeric column types (LONG, BIGINT)", () => {
      const mockHeaderGroups = [
        {
          id: "headerGroup1",
          depth: 0,
          headers: [
            {
              id: "header1",
              column: {
                columnDef: {
                  header: "Big Number",
                  size: 120,
                  meta: { type: "LONG" },
                },
              },
              isPlaceholder: false,
              getContext: () => ({}),
            },
            {
              id: "header2",
              column: {
                columnDef: {
                  header: "Very Big Number",
                  size: 140,
                  meta: { type: "BIGINT" },
                },
              },
              isPlaceholder: false,
              getContext: () => ({}),
            },
          ],
        },
      ] as any;

      render(
        <table>
          <ExperimentTableHeader headerGroups={mockHeaderGroups} />
        </table>,
      );

      const longHeader = screen.getByText("Big Number").closest("th");
      const bigintHeader = screen.getByText("Very Big Number").closest("th");

      expect(longHeader).toHaveClass("text-right");
      expect(bigintHeader).toHaveClass("text-right");
    });

    it("should handle placeholder headers", () => {
      const mockHeaderGroups = [
        {
          id: "headerGroup1",
          depth: 0,
          headers: [
            {
              id: "header1",
              column: {
                columnDef: {
                  header: "Visible Header",
                  size: 100,
                  meta: { type: "STRING" },
                },
              },
              isPlaceholder: false,
              getContext: () => ({}),
            },
            {
              id: "header2",
              column: {
                columnDef: {
                  header: "Hidden Header",
                  size: 100,
                  meta: { type: "STRING" },
                },
              },
              isPlaceholder: true,
              getContext: () => ({}),
            },
          ],
        },
      ] as any;

      render(
        <table>
          <ExperimentTableHeader headerGroups={mockHeaderGroups} />
        </table>,
      );

      expect(screen.getByText("Visible Header")).toBeInTheDocument();
      expect(screen.queryByText("Hidden Header")).not.toBeInTheDocument();
    });

    it("should handle headers without meta type", () => {
      const mockHeaderGroups = [
        {
          id: "headerGroup1",
          depth: 0,
          headers: [
            {
              id: "header1",
              column: {
                columnDef: {
                  header: "No Meta",
                  size: 100,
                  meta: undefined,
                },
              },
              isPlaceholder: false,
              getContext: () => ({}),
            },
            {
              id: "header2",
              column: {
                columnDef: {
                  header: "Empty Meta",
                  size: 100,
                  meta: {},
                },
              },
              isPlaceholder: false,
              getContext: () => ({}),
            },
          ],
        },
      ] as any;

      render(
        <table>
          <ExperimentTableHeader headerGroups={mockHeaderGroups} />
        </table>,
      );

      const noMetaHeader = screen.getByText("No Meta").closest("th");
      const emptyMetaHeader = screen.getByText("Empty Meta").closest("th");

      expect(noMetaHeader).toHaveClass("text-left");
      expect(emptyMetaHeader).toHaveClass("text-left");
    });
  });

  describe("ExperimentDataRows", () => {
    it("should render no results message when rows array is empty", () => {
      render(
        <table>
          <tbody>
            <ExperimentDataRows rows={[]} columnCount={3} />
          </tbody>
        </table>,
      );

      expect(screen.getByText("No results found")).toBeInTheDocument();

      const cell = screen.getByText("No results found").closest("td");
      expect(cell).toHaveAttribute("colSpan", "3");
      expect(cell).toHaveClass("h-4", "text-center");
    });

    it("should render data rows with cells", () => {
      const mockRows = [
        {
          id: "row1",
          getIsSelected: () => false,
          getVisibleCells: () => [
            {
              id: "cell1",
              column: { columnDef: { size: 150, cell: "Cell 1" } },
              getContext: () => ({}),
            },
            {
              id: "cell2",
              column: { columnDef: { size: 100, cell: "Cell 2" } },
              getContext: () => ({}),
            },
          ],
        },
        {
          id: "row2",
          getIsSelected: () => true,
          getVisibleCells: () => [
            {
              id: "cell3",
              column: { columnDef: { size: 150, cell: "Cell 3" } },
              getContext: () => ({}),
            },
            {
              id: "cell4",
              column: { columnDef: { size: 100, cell: "Cell 4" } },
              getContext: () => ({}),
            },
          ],
        },
      ] as any;

      render(
        <table>
          <tbody>
            <ExperimentDataRows rows={mockRows} columnCount={2} />
          </tbody>
        </table>,
      );

      // Check that rows are rendered
      const rows = screen.getAllByRole("row");
      expect(rows).toHaveLength(2);

      // Check that first row has data-state="false" (not selected)
      expect(rows[0]).toHaveAttribute("data-state", "false");

      // Check that second row is selected
      expect(rows[1]).toHaveAttribute("data-state", "selected");

      // Check that cells have correct styles
      const cells = screen.getAllByRole("cell");
      expect(cells).toHaveLength(4);

      // First row cells
      expect(cells[0]).toHaveStyle({ minWidth: "150px" });
      expect(cells[1]).toHaveStyle({ minWidth: "100px" });

      // Second row cells
      expect(cells[2]).toHaveStyle({ minWidth: "150px" });
      expect(cells[3]).toHaveStyle({ minWidth: "100px" });

      // Check that flexRender was called with correct parameters
      expect(screen.getByText("Cell 1")).toBeInTheDocument();
      expect(screen.getByText("Cell 2")).toBeInTheDocument();
      expect(screen.getByText("Cell 3")).toBeInTheDocument();
      expect(screen.getByText("Cell 4")).toBeInTheDocument();
    });

    it("should handle rows with different selection states", () => {
      const mockRows = [
        {
          id: "row1",
          getIsSelected: () => false,
          getVisibleCells: () => [
            {
              id: "cell1",
              column: { columnDef: { size: 100, cell: "Unselected Cell" } },
              getContext: () => ({}),
            },
          ],
        },
        {
          id: "row2",
          getIsSelected: () => true,
          getVisibleCells: () => [
            {
              id: "cell2",
              column: { columnDef: { size: 100, cell: "Selected Cell" } },
              getContext: () => ({}),
            },
          ],
        },
      ] as any;

      render(
        <table>
          <tbody>
            <ExperimentDataRows rows={mockRows} columnCount={1} />
          </tbody>
        </table>,
      );

      const rows = screen.getAllByRole("row");

      // First row should have data-state="false" (not selected)
      expect(rows[0]).toHaveAttribute("data-state", "false");

      // Second row should have data-state="selected"
      expect(rows[1]).toHaveAttribute("data-state", "selected");

      // Check cell content
      expect(screen.getByText("Unselected Cell")).toBeInTheDocument();
      expect(screen.getByText("Selected Cell")).toBeInTheDocument();
    });
  });
});
