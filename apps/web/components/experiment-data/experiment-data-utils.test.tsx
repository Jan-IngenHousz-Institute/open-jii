/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { WellKnownColumnTypes } from "@repo/api";

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
  ArrowUp: () => <div data-testid="arrow-up">↑</div>,
  ArrowDown: () => <div data-testid="arrow-down">↓</div>,
  ArrowUpDown: () => <div data-testid="arrow-up-down">↕</div>,
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
    onClick,
  }: {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    onClick?: () => void;
  }) => (
    <th className={className} style={style} onClick={onClick}>
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
  Avatar: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="avatar" className={className}>
      {children}
    </div>
  ),
  AvatarImage: ({ src: _src, alt }: { src?: string; alt?: string }) => (
    <div data-testid="avatar-image" aria-label={alt} />
  ),
  AvatarFallback: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="avatar-fallback" className={className}>
      {children}
    </div>
  ),
}));

// Mock experiment data table components
vi.mock("./table-cells/array/experiment-data-table-array-cell", () => ({
  ExperimentDataTableArrayCell: ({ data }: { data: string }) => {
    try {
      const parsed = JSON.parse(data) as unknown;
      if (Array.isArray(parsed)) {
        const count = parsed.length;
        return (
          <div data-testid="array-cell">
            {count} {count === 1 ? "item" : "items"}
          </div>
        );
      }
    } catch {
      // If parsing fails, just return the data
    }
    return <div data-testid="array-cell">{data}</div>;
  },
}));

vi.mock("./table-cells/chart/experiment-data-table-chart-cell", () => ({
  ExperimentDataTableChartCell: ({ data }: { data: string }) => (
    <div data-testid="chart-cell">{data}</div>
  ),
}));

vi.mock("./table-cells/map/experiment-data-table-map-cell", () => ({
  ExperimentDataTableMapCell: ({ data }: { data: string }) => {
    try {
      const parsed = JSON.parse(data) as unknown;
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        const entries = Object.entries(parsed as Record<string, unknown>);
        if (entries.length === 1) {
          const [key, value] = entries[0];
          return (
            <div data-testid="map-cell">
              <span className="font-medium">{key}:</span> {String(value)}
            </div>
          );
        }
        return <div data-testid="map-cell">{entries.length} entries</div>;
      }
    } catch {
      // If parsing fails, just return the data
    }
    return <div data-testid="map-cell">{data}</div>;
  },
}));

vi.mock("./table-cells/annotations/experiment-data-table-annotations-cell", () => ({
  ExperimentDataTableAnnotationsCell: ({
    data,
    rowId,
  }: {
    data: string;
    rowId: string;
    onAddAnnotation?: () => void;
    onDeleteAnnotations?: () => void;
  }) => {
    try {
      const parsed = JSON.parse(data) as unknown[];
      return (
        <div data-testid="annotations-cell">
          {Array.isArray(parsed) ? `${parsed.length} annotations` : "0 annotations"} (row: {rowId})
        </div>
      );
    } catch {
      return <div data-testid="annotations-cell">Invalid annotations data</div>;
    }
  },
}));

vi.mock("./table-cells/user/experiment-data-table-user-cell", () => ({
  ExperimentDataTableUserCell: ({ data }: { data: string }) => {
    try {
      const parsed = JSON.parse(data) as { name?: string };
      return (
        <div data-testid="user-cell">
          <div>{parsed.name ?? "Unknown User"}</div>
          <div>{parsed.name?.match(/\b(\w)/g)?.join("") ?? "??"}</div>
        </div>
      );
    } catch {
      return <div data-testid="user-cell">{data}</div>;
    }
  },
}));

vi.mock("./table-cells/text/experiment-data-table-text-cell", () => ({
  ExperimentDataTableTextCell: ({ text }: { text: string }) => (
    <div data-testid="text-cell">{text}</div>
  ),
}));

vi.mock("./table-cells/struct/experiment-data-table-struct-cell", () => ({
  ExperimentDataTableStructCell: ({ data }: { data: string }) => (
    <div data-testid="struct-cell">{data}</div>
  ),
}));

vi.mock("./table-cells/variant/experiment-data-table-variant-cell", () => ({
  ExperimentDataTableVariantCell: ({ data: _data }: { data: string }) => (
    <div data-testid="variant-cell">JSON</div>
  ),
}));

vi.mock("./table-cells/error/experiment-data-table-error-cell", () => ({
  ExperimentDataTableErrorCell: ({ error }: { error: string }) => (
    <div data-testid="error-cell">{error}</div>
  ),
}));

vi.mock("./experiment-data-table-cell-collapsible", () => ({
  ExperimentDataTableCellCollapsible: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="collapsible-cell">{children}</div>
  ),
}));

describe("experiment-data-utils", () => {
  describe("formatValue", () => {
    it("should format numeric values with right alignment", () => {
      const result = formatValue(123.45, "DOUBLE", "row-1");
      expect(result).toEqual(<div className="text-right tabular-nums">{123.45}</div>);
    });

    it("should format INT values with right alignment", () => {
      const result = formatValue(42, "INT", "row-1");
      expect(result).toEqual(<div className="text-right tabular-nums">{42}</div>);
    });

    it("should format LONG values with right alignment", () => {
      const result = formatValue(1234567890, "LONG", "row-1");
      expect(result).toEqual(<div className="text-right tabular-nums">{1234567890}</div>);
    });

    it("should format BIGINT values with right alignment", () => {
      const result = formatValue(9876543210, "BIGINT", "row-1");
      expect(result).toEqual(<div className="text-right tabular-nums">{9876543210}</div>);
    });

    it("should format TIMESTAMP values by truncating and replacing T", () => {
      const result = formatValue("2023-01-01T10:30:45.123Z", "TIMESTAMP", "row-1");
      expect(result).toBe("2023-01-01 10:30:45");
    });

    it("should render ExperimentDataTableUserCell for USER type", () => {
      const userData = JSON.stringify({
        id: "user-123",
        name: "John Doe",
        image: "https://example.com/avatar.jpg",
      });
      const result = formatValue(
        userData,
        WellKnownColumnTypes.CONTRIBUTOR,
        "row-1",
        "test-column",
      );

      // The result should be a React element (ExperimentDataTableUserCell)
      expect(React.isValidElement(result)).toBe(true);

      // Render it to check the component
      render(<div>{result}</div>);
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      // Avatar initials should be shown as fallback in test environment
      expect(screen.getByText("JD")).toBeInTheDocument();
    });

    it("should return string values as-is for other types", () => {
      const result = formatValue("test string", "STRING", "row-1");
      expect(React.isValidElement(result)).toBe(true);
    });

    it("should handle null values", () => {
      const result = formatValue(null, "STRING", "row-1");
      expect(result).toBe("");
    });

    it("should render ExperimentDataTableMapCell for MAP type", () => {
      const result = formatValue('{"key": "value"}', "MAP", "row-1", "test-column");

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
        "row-1",
        "test-column",
      );

      // The result should be a React element (ExperimentDataTableMapCell)
      expect(React.isValidElement(result)).toBe(true);

      // Render it to check the component
      render(<div>{result}</div>);
      expect(screen.getByText("2 entries")).toBeInTheDocument();
    });

    it("should render ExperimentDataTableMapCell for MAP<STRING,INT> type", () => {
      const result = formatValue(
        '{"count": 5, "total": 10}',
        "MAP<STRING,INT>",
        "row-1",
        "test-column",
      );

      // The result should be a React element (ExperimentDataTableMapCell)
      expect(React.isValidElement(result)).toBe(true);

      // Render it to check the component
      render(<div>{result}</div>);
      expect(screen.getByText("2 entries")).toBeInTheDocument();
    });

    it("should render ExperimentDataTableArrayCell for ARRAY<STRUCT<...>> type", () => {
      const arrayData = JSON.stringify([
        { question_label: "question1", question_text: "text1", question_answer: "answer1" },
        { question_label: "question2", question_text: "text2", question_answer: "answer2" },
      ]);
      const result = formatValue(
        arrayData,
        "ARRAY<STRUCT<question_label: STRING, question_text: STRING, question_answer: STRING>>",
        "row-1",
        "test-column",
      );

      // The result should be a React element (ExperimentDataTableArrayCell)
      expect(React.isValidElement(result)).toBe(true);

      // Render it to check the component
      render(<div>{result}</div>);
      expect(screen.getByText("2 items")).toBeInTheDocument();
    });

    it("should render ExperimentDataTableArrayCell for nested ARRAY<STRUCT<...>> type", () => {
      const arrayData = JSON.stringify([{ name: "John", details: { age: 30, city: "NYC" } }]);
      const result = formatValue(
        arrayData,
        "ARRAY<STRUCT<name: STRING, details: STRUCT<age: INT, city: STRING>>>",
        "row-1",
        "test-column",
      );

      // The result should be a React element (ExperimentDataTableArrayCell)
      expect(React.isValidElement(result)).toBe(true);

      // Render it to check the component
      render(<div>{result}</div>);
      expect(screen.getByText("1 item")).toBeInTheDocument();
    });

    it("should render ExperimentDataTableVariantCell for VARIANT type", () => {
      const variantData = JSON.stringify({ name: "John", age: 30, active: true });
      const result = formatValue(variantData, "VARIANT", "row-1", "test-column");

      // The result should be a React element (ExperimentDataTableVariantCell)
      expect(React.isValidElement(result)).toBe(true);

      // Render it to check the component
      render(<div>{result}</div>);
      expect(screen.getByText("JSON")).toBeInTheDocument();
    });

    it("should render ExperimentDataTableChartCell for numeric ARRAY types", () => {
      const mockOnChartHover = vi.fn();
      const mockOnChartLeave = vi.fn();
      const mockOnChartClick = vi.fn();

      const result = formatValue(
        "[1.5, 2.3, 3.7, 4.2]",
        "ARRAY<DOUBLE>",
        "row-1",
        "test-column",
        mockOnChartHover,
        mockOnChartLeave,
        mockOnChartClick,
      );

      // The result should be a React element (ExperimentDataTableChartCell)
      expect(React.isValidElement(result)).toBe(true);

      // Since we can't easily test the chart component without full setup,
      // we'll just verify it's a valid React element
      expect(result).toBeDefined();
    });

    it("should handle ARRAY type with numeric arrays in default case", () => {
      const mockOnChartHover = vi.fn();
      const mockOnChartLeave = vi.fn();
      const mockOnChartClick = vi.fn();

      const result = formatValue(
        "[1, 2, 3, 4, 5]",
        "ARRAY<NUMERIC>",
        "row-1",
        "test-column",
        mockOnChartHover,
        mockOnChartLeave,
        mockOnChartClick,
      );

      // The result should be a React element (ExperimentDataTableChartCell)
      expect(React.isValidElement(result)).toBe(true);
      expect(result).toBeDefined();
    });

    it("should handle ARRAY<REAL> type with chart cell", () => {
      const mockOnChartClick = vi.fn();
      const result = formatValue(
        "[1.1, 2.2, 3.3]",
        "ARRAY<REAL>",
        "row-1",
        "test-column",
        mockOnChartClick,
      );

      expect(React.isValidElement(result)).toBe(true);
      expect(result).toBeDefined();
    });

    it("should handle ARRAY<FLOAT> type with chart cell", () => {
      const mockOnChartClick = vi.fn();
      const result = formatValue(
        "[5.5, 6.6, 7.7]",
        "ARRAY<FLOAT>",
        "row-1",
        "test-column",
        mockOnChartClick,
      );

      expect(React.isValidElement(result)).toBe(true);
      expect(result).toBeDefined();
    });

    it("should handle complex type with ARRAY and DOUBLE in default case", () => {
      const mockOnChartClick = vi.fn();
      const result = formatValue(
        "[10, 20, 30]",
        "CUSTOM_ARRAY_DOUBLE_TYPE",
        "row-1",
        "test-column",
        mockOnChartClick,
      );

      expect(React.isValidElement(result)).toBe(true);
      expect(result).toBeDefined();
    });

    it("should handle complex type with ARRAY and REAL in default case", () => {
      const mockOnChartClick = vi.fn();
      const result = formatValue(
        "[1.5, 2.5, 3.5]",
        "SPECIAL_ARRAY_REAL_DATA",
        "row-1",
        "test-column",
        mockOnChartClick,
      );

      expect(React.isValidElement(result)).toBe(true);
      expect(result).toBeDefined();
    });

    it("should handle complex type with ARRAY and FLOAT in default case", () => {
      const mockOnChartClick = vi.fn();
      const result = formatValue(
        "[8.8, 9.9]",
        "CUSTOM_ARRAY_FLOAT",
        "row-1",
        "test-column",
        mockOnChartClick,
      );

      expect(React.isValidElement(result)).toBe(true);
      expect(result).toBeDefined();
    });

    it("should handle complex type with ARRAY and NUMERIC in default case", () => {
      const mockOnChartClick = vi.fn();
      const result = formatValue(
        "[100, 200, 300]",
        "ARRAY_NUMERIC_CUSTOM",
        "row-1",
        "test-column",
        mockOnChartClick,
      );

      expect(React.isValidElement(result)).toBe(true);
      expect(result).toBeDefined();
    });

    it("should return string for unknown types in default case", () => {
      const result = formatValue("some value", "UNKNOWN_TYPE", "row-1");
      // Fallback is ExperimentDataTableTextCell
      expect(React.isValidElement(result)).toBe(true);
      const { getByTestId } = render(<div>{result}</div>);
      expect(getByTestId("text-cell")).toHaveTextContent("some value");
    });

    it("should handle MAP type without STRING prefix", () => {
      const result = formatValue('{"key": "value"}', "MAP", "row-1", "test-column");
      expect(React.isValidElement(result)).toBe(true);

      render(<div>{result}</div>);
      expect(screen.getByText("key:")).toBeInTheDocument();
    });

    it("should handle complex MAP types with different value types", () => {
      const result = formatValue(
        '{"id": 123, "active": true}',
        "MAP<STRING,MIXED>",
        "row-1",
        "test-column",
      );
      expect(React.isValidElement(result)).toBe(true);

      render(<div>{result}</div>);
      expect(screen.getByTestId("map-cell")).toBeInTheDocument();
    });

    it("should handle annotations struct type", () => {
      const annotationsData = JSON.stringify([
        {
          id: "ann-1",
          rowId: "row-1",
          type: "comment",
          content: { text: "Test comment", flagType: "" },
          createdBy: "user-1",
          createdByName: "John Doe",
          createdAt: "2023-01-01T10:00:00Z",
          updatedAt: "2023-01-01T10:00:00Z",
        },
      ]);

      const mockOnAddAnnotation = vi.fn();
      const mockOnDeleteAnnotations = vi.fn();

      const result = formatValue(
        annotationsData,
        "ARRAY<STRUCT<id: STRING, rowId: STRING, type: STRING, content: STRUCT<text: STRING, flagType: STRING>, createdBy: STRING, createdByName: STRING, createdAt: TIMESTAMP, updatedAt: TIMESTAMP>>",
        "row-1",
        "annotations",
        undefined,
        mockOnAddAnnotation,
        mockOnDeleteAnnotations,
      );

      expect(React.isValidElement(result)).toBe(true);

      // Render and verify the annotations cell
      render(<div>{result}</div>);
      expect(screen.getByTestId("annotations-cell")).toBeInTheDocument();
      expect(screen.getByText(/1 annotations/)).toBeInTheDocument();
      expect(screen.getByText(/row: row-1/)).toBeInTheDocument();
    });

    it("should handle basic ARRAY type for numeric data", () => {
      const mockOnChartClick = vi.fn();
      const result = formatValue(
        "[1, 2, 3, 4, 5]",
        "ARRAY",
        "row-1",
        "test-column",
        mockOnChartClick,
      );

      expect(React.isValidElement(result)).toBe(true);
    });

    it("should handle unknown type and return as string", () => {
      const result = formatValue("test value", "UNKNOWN_CUSTOM_TYPE", "row-1");
      // Fallback is ExperimentDataTableTextCell
      expect(React.isValidElement(result)).toBe(true);
      const { getByTestId } = render(<div>{result}</div>);
      expect(getByTestId("text-cell")).toHaveTextContent("test value");
    });
  });

  describe("LoadingRows", () => {
    it("should render skeleton rows without loading message", () => {
      render(
        <table>
          <tbody>
            <LoadingRows rowCount={3} columnCount={2} />
          </tbody>
        </table>,
      );

      // Should not display loading text anymore
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();

      // Should render 3 skeleton rows with 2 columns each
      const skeletons = screen.getAllByTestId("skeleton");
      expect(skeletons).toHaveLength(6); // 3 rows × 2 columns
    });

    it("should render correct number of skeleton cells", () => {
      render(
        <table>
          <tbody>
            <LoadingRows rowCount={2} columnCount={3} />
          </tbody>
        </table>,
      );

      // Should render 2 skeleton rows with 3 columns
      const skeletons = screen.getAllByTestId("skeleton");
      expect(skeletons).toHaveLength(6); // 2 rows × 3 columns
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
                id: "name",
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
                id: "value",
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
                id: "count",
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
                id: "bigNumber",
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
                id: "veryBigNumber",
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
                id: "visibleHeader",
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
                id: "hiddenHeader",
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
                id: "noMeta",
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
                id: "emptyMeta",
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

    it("should render sort icons and handle sorting", () => {
      const mockOnSort = vi.fn();
      const mockHeaderGroups = [
        {
          id: "headerGroup1",
          depth: 0,
          headers: [
            {
              id: "header1",
              column: {
                id: "name",
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
                id: "timestamp",
                columnDef: {
                  header: "Timestamp",
                  size: 180,
                  meta: { type: "TIMESTAMP" },
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
          <ExperimentTableHeader
            headerGroups={mockHeaderGroups}
            sortColumn="timestamp"
            sortDirection="DESC"
            onSort={mockOnSort}
          />
        </table>,
      );

      // Check that headers are clickable
      const nameHeader = screen.getByText("Name").closest("th");
      const timestampHeader = screen.getByText("Timestamp").closest("th");

      expect(nameHeader).toHaveClass("cursor-pointer");
      expect(timestampHeader).toHaveClass("cursor-pointer");

      // Check sort indicators are present
      expect(screen.getByTestId("arrow-up-down")).toBeInTheDocument(); // For unsorted "name"
      expect(screen.getByTestId("arrow-down")).toBeInTheDocument(); // For sorted "timestamp" DESC
    });

    it("should show ASC sort icon for ascending sort", () => {
      const mockHeaderGroups = [
        {
          id: "headerGroup1",
          depth: 0,
          headers: [
            {
              id: "header1",
              column: {
                id: "name",
                columnDef: {
                  header: "Name",
                  size: 150,
                  meta: { type: "STRING" },
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
          <ExperimentTableHeader
            headerGroups={mockHeaderGroups}
            sortColumn="name"
            sortDirection="ASC"
            onSort={vi.fn()}
          />
        </table>,
      );

      expect(screen.getByTestId("arrow-up")).toBeInTheDocument();
    });

    it("should not show sort icons when onSort is not provided", () => {
      const mockHeaderGroups = [
        {
          id: "headerGroup1",
          depth: 0,
          headers: [
            {
              id: "header1",
              column: {
                id: "name",
                columnDef: {
                  header: "Name",
                  size: 150,
                  meta: { type: "STRING" },
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

      const nameHeader = screen.getByText("Name").closest("th");
      expect(nameHeader).not.toHaveClass("cursor-pointer");
      expect(screen.queryByTestId("arrow-up-down")).not.toBeInTheDocument();
    });

    it("should not make checkbox column sortable", () => {
      const mockOnSort = vi.fn();
      const mockHeaderGroups = [
        {
          id: "headerGroup1",
          depth: 0,
          headers: [
            {
              id: "select",
              column: {
                id: "select",
                columnDef: {
                  header: () => <div>Select</div>,
                  size: 50,
                  meta: {},
                },
              },
              isPlaceholder: false,
              getContext: () => ({}),
            },
            {
              id: "header1",
              column: {
                id: "name",
                columnDef: {
                  header: "Name",
                  size: 150,
                  meta: { type: "STRING" },
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
          <ExperimentTableHeader
            headerGroups={mockHeaderGroups}
            sortColumn="name"
            sortDirection="ASC"
            onSort={mockOnSort}
          />
        </table>,
      );

      const selectHeader = screen.getByText("Select").closest("th");
      const nameHeader = screen.getByText("Name").closest("th");

      // Select column should not be sortable
      expect(selectHeader).not.toHaveClass("cursor-pointer");

      // Name column should be sortable
      expect(nameHeader).toHaveClass("cursor-pointer");
    });

    it("should not show sort icons for unsortable column types - MAP", () => {
      const mockOnSort = vi.fn();
      const mockHeaderGroups = [
        {
          id: "headerGroup1",
          depth: 0,
          headers: [
            {
              id: "header1",
              column: {
                id: "mapColumn",
                columnDef: {
                  header: "Map Data",
                  size: 150,
                  meta: { type: "MAP<STRING,STRING>" },
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
          <ExperimentTableHeader
            headerGroups={mockHeaderGroups}
            sortColumn="name"
            sortDirection="ASC"
            onSort={mockOnSort}
          />
        </table>,
      );

      const mapHeader = screen.getByText("Map Data").closest("th");
      expect(mapHeader).not.toHaveClass("cursor-pointer");
      expect(screen.queryByTestId("arrow-up-down")).not.toBeInTheDocument();
    });

    it("should not show sort icons for unsortable column types - ARRAY", () => {
      const mockOnSort = vi.fn();
      const mockHeaderGroups = [
        {
          id: "headerGroup1",
          depth: 0,
          headers: [
            {
              id: "header1",
              column: {
                id: "arrayColumn",
                columnDef: {
                  header: "Array Data",
                  size: 150,
                  meta: { type: "ARRAY<STRUCT<...>>" },
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
          <ExperimentTableHeader
            headerGroups={mockHeaderGroups}
            sortColumn="name"
            sortDirection="ASC"
            onSort={mockOnSort}
          />
        </table>,
      );

      const arrayHeader = screen.getByText("Array Data").closest("th");
      expect(arrayHeader).not.toHaveClass("cursor-pointer");
    });

    it("should not show sort icons for unsortable column types - STRUCT", () => {
      const mockOnSort = vi.fn();
      const mockHeaderGroups = [
        {
          id: "headerGroup1",
          depth: 0,
          headers: [
            {
              id: "header1",
              column: {
                id: "structColumn",
                columnDef: {
                  header: "Struct Data",
                  size: 150,
                  meta: { type: "STRUCT<field1: STRING, field2: INT>" },
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
          <ExperimentTableHeader
            headerGroups={mockHeaderGroups}
            sortColumn="name"
            sortDirection="ASC"
            onSort={mockOnSort}
          />
        </table>,
      );

      const structHeader = screen.getByText("Struct Data").closest("th");
      expect(structHeader).not.toHaveClass("cursor-pointer");
    });

    it("should show sort icons for BOOLEAN type", () => {
      const mockOnSort = vi.fn();
      const mockHeaderGroups = [
        {
          id: "headerGroup1",
          depth: 0,
          headers: [
            {
              id: "header1",
              column: {
                id: "boolColumn",
                columnDef: {
                  header: "Boolean",
                  size: 100,
                  meta: { type: "BOOLEAN" },
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
          <ExperimentTableHeader
            headerGroups={mockHeaderGroups}
            sortColumn="boolColumn"
            sortDirection="ASC"
            onSort={mockOnSort}
          />
        </table>,
      );

      const boolHeader = screen.getByText("Boolean").closest("th");
      expect(boolHeader).toHaveClass("cursor-pointer");
      expect(screen.getByTestId("arrow-up")).toBeInTheDocument();
    });

    it("should show sort icons for DATE type", () => {
      const mockOnSort = vi.fn();
      const mockHeaderGroups = [
        {
          id: "headerGroup1",
          depth: 0,
          headers: [
            {
              id: "header1",
              column: {
                id: "dateColumn",
                columnDef: {
                  header: "Date",
                  size: 120,
                  meta: { type: "DATE" },
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
          <ExperimentTableHeader
            headerGroups={mockHeaderGroups}
            sortColumn="dateColumn"
            sortDirection="DESC"
            onSort={mockOnSort}
          />
        </table>,
      );

      const dateHeader = screen.getByText("Date").closest("th");
      expect(dateHeader).toHaveClass("cursor-pointer");
      expect(screen.getByTestId("arrow-down")).toBeInTheDocument();
    });

    it("should show sort icons for USER type", () => {
      const mockOnSort = vi.fn();
      const mockHeaderGroups = [
        {
          id: "headerGroup1",
          depth: 0,
          headers: [
            {
              id: "header1",
              column: {
                id: "userColumn",
                columnDef: {
                  header: "User",
                  size: 150,
                  meta: { type: WellKnownColumnTypes.CONTRIBUTOR },
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
          <ExperimentTableHeader
            headerGroups={mockHeaderGroups}
            sortColumn="userColumn.name"
            sortDirection="ASC"
            onSort={mockOnSort}
          />
        </table>,
      );

      const userHeader = screen.getByText("User").closest("th");
      expect(userHeader).toHaveClass("cursor-pointer");
      expect(screen.getByTestId("arrow-up")).toBeInTheDocument();
    });

    it("should call onSort with column name and type when header is clicked", () => {
      const mockOnSort = vi.fn();
      const mockHeaderGroups = [
        {
          id: "headerGroup1",
          depth: 0,
          headers: [
            {
              id: "header1",
              column: {
                id: "regularColumn",
                columnDef: {
                  header: "Regular Column",
                  size: 150,
                  meta: { type: "STRING" },
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
          <ExperimentTableHeader
            headerGroups={mockHeaderGroups}
            sortColumn="regularColumn"
            sortDirection="DESC"
            onSort={mockOnSort}
          />
        </table>,
      );

      const regularHeader = screen.getByText("Regular Column").closest("th");
      expect(regularHeader).toHaveClass("cursor-pointer");

      // Click to trigger sort
      fireEvent.click(regularHeader as HTMLElement);

      // Should be called with the actual column name and type
      expect(mockOnSort).toHaveBeenCalledWith("regularColumn", "STRING");
    });

    it("should treat unknown types as sortable by default", () => {
      const mockOnSort = vi.fn();
      const mockHeaderGroups = [
        {
          id: "headerGroup1",
          depth: 0,
          headers: [
            {
              id: "header1",
              column: {
                id: "customColumn",
                columnDef: {
                  header: "Custom Type",
                  size: 150,
                  meta: { type: "CUSTOM_UNKNOWN_TYPE" },
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
          <ExperimentTableHeader
            headerGroups={mockHeaderGroups}
            sortColumn="customColumn"
            sortDirection="ASC"
            onSort={mockOnSort}
          />
        </table>,
      );

      const customHeader = screen.getByText("Custom Type").closest("th");
      // Unknown types should default to sortable
      expect(customHeader).toHaveClass("cursor-pointer");
      expect(screen.getByTestId("arrow-up")).toBeInTheDocument();
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
          original: { id: "row1" },
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
          original: { id: "row2" },
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
          original: { id: "row1" },
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
          original: { id: "row2" },
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
