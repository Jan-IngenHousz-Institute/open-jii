import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ExperimentDataTableMapCell, MapExpandedContent } from "./experiment-data-table-map-cell";

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  ChevronDown: () => <div data-testid="chevron-down">▼</div>,
  ChevronRight: () => <div data-testid="chevron-right">▶</div>,
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Collapsible: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <div data-testid="collapsible" data-open={String(open)} onClick={() => onOpenChange?.(!open)}>
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
    className: _className,
    onClick,
  }: {
    children: React.ReactNode;
    variant?: string;
    size?: string;
    className?: string;
    onClick?: () => void;
  }) => (
    <button onClick={onClick} data-testid="button">
      {children}
    </button>
  ),
}));

describe("ExperimentDataTableMapCell", () => {
  it("should render simple text for non-map data", () => {
    render(
      <ExperimentDataTableMapCell
        data="simple text"
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("simple text")).toBeInTheDocument();
  });

  it("should render empty map message", () => {
    render(
      <ExperimentDataTableMapCell
        data="{}"
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("Empty map")).toBeInTheDocument();
  });

  it("should render single entry without collapsible", () => {
    render(
      <ExperimentDataTableMapCell
        data='{"key1": "value1"}'
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("key1:")).toBeInTheDocument();
    expect(screen.getByText("value1")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("should render collapsible for multiple entries", () => {
    render(
      <ExperimentDataTableMapCell
        data='{"key1": "value1", "key2": "value2"}'
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("2 entries")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should show chevron-right when collapsed", () => {
    render(
      <ExperimentDataTableMapCell
        data='{"a": "1", "b": "2"}'
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByTestId("chevron-right")).toBeInTheDocument();
  });

  it("should show chevron-down when expanded", () => {
    render(
      <ExperimentDataTableMapCell
        data='{"a": "1", "b": "2"}'
        columnName="test"
        rowId="test-row"
        isExpanded={true}
      />,
    );
    expect(screen.getByTestId("chevron-down")).toBeInTheDocument();
  });

  it("should handle toggle interactions", () => {
    render(
      <ExperimentDataTableMapCell
        data='{"a": "1", "b": "2"}'
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );

    const collapsible = screen.getByTestId("collapsible");
    expect(collapsible.getAttribute("data-open")).toBe("false");

    fireEvent.click(collapsible);
    fireEvent.click(collapsible);

    expect(screen.getByText("2 entries")).toBeInTheDocument();
  });

  it("should parse key-value format with equals signs", () => {
    render(
      <ExperimentDataTableMapCell
        data="key1=value1,key2=value2"
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("2 entries")).toBeInTheDocument();
  });

  it("should handle invalid JSON gracefully", () => {
    render(
      <ExperimentDataTableMapCell
        data="invalid json {"
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("invalid json {")).toBeInTheDocument();
  });

  it("should handle null, undefined, and empty values", () => {
    const { container } = render(
      <ExperimentDataTableMapCell
        data={null as unknown as string}
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(container.querySelector("span")).toBeInTheDocument();
  });

  it("should format different value types", () => {
    render(
      <ExperimentDataTableMapCell
        data='{"string": "hello", "number": 42, "boolean": true, "null": null}'
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("4 entries")).toBeInTheDocument();
  });

  it("should stringify object values", () => {
    render(
      <ExperimentDataTableMapCell
        data='{"config": {"theme": "dark"}}'
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("config:")).toBeInTheDocument();
    expect(screen.getByText('{"theme":"dark"}')).toBeInTheDocument();
  });

  it("should stringify array values", () => {
    render(
      <ExperimentDataTableMapCell
        data='{"items": [1, 2, 3]}'
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("items:")).toBeInTheDocument();
    expect(screen.getByText("[1,2,3]")).toBeInTheDocument();
  });

  it("should handle complex nested structures", () => {
    const complexData = {
      user: { profile: { name: "John" } },
      settings: ["s1", "s2"],
      metadata: null,
    };

    render(
      <ExperimentDataTableMapCell
        data={JSON.stringify(complexData)}
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("3 entries")).toBeInTheDocument();
  });

  it("should handle special characters and unicode", () => {
    render(
      <ExperimentDataTableMapCell
        data='{"emoji": "🚀", "chinese": "你好", "special": "@#$%"}'
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("3 entries")).toBeInTheDocument();
  });

  it("should handle key-value format with spaces", () => {
    render(
      <ExperimentDataTableMapCell
        data="key1 = value1, key2 = value2"
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("2 entries")).toBeInTheDocument();
  });

  it("should handle rerender correctly", () => {
    const { rerender } = render(
      <ExperimentDataTableMapCell
        data='{"key": "value"}'
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );

    rerender(
      <ExperimentDataTableMapCell
        data='{"key": "newValue"}'
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );

    expect(screen.getByText("key:")).toBeInTheDocument();
    expect(screen.getByText("newValue")).toBeInTheDocument();
  });

  it("should handle DOM manipulation gracefully without table structure", () => {
    const { container } = render(
      <div>
        <ExperimentDataTableMapCell
          data='{"key1": "value1", "key2": "value2"}'
          columnName="test"
          rowId="test-row"
          isExpanded={false}
        />
      </div>,
    );

    const button = screen.getByRole("button");
    expect(() => fireEvent.click(button)).not.toThrow();

    const expandedRows = container.querySelectorAll(".map-expanded-row");
    expect(expandedRows.length).toBe(0);
  });
});

describe("MapExpandedContent", () => {
  it("should render map entries with proper formatting", () => {
    render(<MapExpandedContent data='{"name": "John", "age": 30, "active": true}' />);

    expect(screen.getByText("name:")).toBeInTheDocument();
    expect(screen.getByText("John")).toBeInTheDocument();
    expect(screen.getByText("age:")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("active:")).toBeInTheDocument();
    expect(screen.getByText("true")).toBeInTheDocument();
  });

  it("should handle different value types", () => {
    render(
      <MapExpandedContent data='{"str": "hello", "num": 42, "bool": false, "obj": {"key": "val"}, "arr": [1,2], "null": null}' />,
    );

    expect(screen.getByText("str:")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.getByText("num:")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("bool:")).toBeInTheDocument();
    expect(screen.getByText("false")).toBeInTheDocument();
    expect(screen.getByText("obj:")).toBeInTheDocument();
    expect(screen.getByText('{"key":"val"}')).toBeInTheDocument();
    expect(screen.getByText("arr:")).toBeInTheDocument();
    expect(screen.getByText("[1,2]")).toBeInTheDocument();
    expect(screen.getByText("null:")).toBeInTheDocument();
    expect(screen.getByText("null")).toBeInTheDocument();
  });

  it("should return null for invalid JSON", () => {
    const { container } = render(<MapExpandedContent data="invalid json" />);
    expect(container.firstChild).toBeNull();
  });

  it("should return null for array data", () => {
    const { container } = render(<MapExpandedContent data='[{"name": "John"}]' />);
    expect(container.firstChild).toBeNull();
  });

  it("should handle empty map", () => {
    const { container } = render(<MapExpandedContent data="{}" />);
    expect(container.querySelector(".w-full")).toBeInTheDocument();
  });
});
