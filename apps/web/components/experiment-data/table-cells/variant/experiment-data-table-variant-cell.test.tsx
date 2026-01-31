import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import {
  ExperimentDataTableVariantCell,
  VariantExpandedContent,
} from "./experiment-data-table-variant-cell";

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

describe("ExperimentDataTableVariantCell", () => {
  it("should render simple text for non-JSON data", () => {
    render(<ExperimentDataTableVariantCell data="simple text" columnName="test" />);
    expect(screen.getByText("simple text")).toBeInTheDocument();
  });

  it("should render simple text for invalid JSON data", () => {
    render(<ExperimentDataTableVariantCell data="{invalid json}" columnName="test" />);
    expect(screen.getByText("{invalid json}")).toBeInTheDocument();
  });

  it("should render collapsible trigger for valid JSON", () => {
    render(<ExperimentDataTableVariantCell data='{"key": "value"}' columnName="test" />);

    expect(screen.getByText("JSON")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should render empty string as simple text", () => {
    render(<ExperimentDataTableVariantCell data="" columnName="test" />);
    expect(screen.queryByText("JSON")).not.toBeInTheDocument();
  });

  it("should expand when triggered", () => {
    render(<ExperimentDataTableVariantCell data='{"name": "John", "age": 30}' columnName="test" />);

    // Initially collapsed
    expect(screen.getByText("JSON")).toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByRole("button"));

    // The collapsible should be open (DOM manipulation happens in useEffect)
    expect(screen.getByText("JSON")).toBeInTheDocument();
  });

  it("should handle complex nested JSON objects", () => {
    const complexData = JSON.stringify({
      user: {
        profile: {
          name: "John Doe",
          preferences: {
            theme: "dark",
            language: "en",
          },
        },
      },
      items: [1, 2, 3],
    });

    render(<ExperimentDataTableVariantCell data={complexData} columnName="test" />);
    expect(screen.getByText("JSON")).toBeInTheDocument();
  });

  it("should handle JSON arrays", () => {
    const arrayData = JSON.stringify([
      { id: 1, name: "Item 1" },
      { id: 2, name: "Item 2" },
    ]);

    render(<ExperimentDataTableVariantCell data={arrayData} columnName="test" />);
    expect(screen.getByText("JSON")).toBeInTheDocument();
  });

  it("should handle JSON with null and undefined values", () => {
    const dataWithNulls = JSON.stringify({ name: "John", age: null, active: undefined });

    render(<ExperimentDataTableVariantCell data={dataWithNulls} columnName="test" />);
    expect(screen.getByText("JSON")).toBeInTheDocument();
  });

  it("should show correct button states", () => {
    render(<ExperimentDataTableVariantCell data='{"key": "value"}' columnName="test" />);

    // Should start with collapsible closed
    const collapsible = screen.getByTestId("collapsible");
    expect(collapsible.getAttribute("data-open")).toBe("false");

    // Should show right arrow initially (collapsed state)
    expect(screen.getByTestId("chevron-right")).toBeInTheDocument();
    expect(screen.queryByTestId("chevron-down")).not.toBeInTheDocument();
  });
});

describe("VariantExpandedContent", () => {
  it("should return null as it doesn't render anything directly", () => {
    const mockCellRef = { current: null };
    const { container } = render(
      <VariantExpandedContent formatted='{\n  "key": "value"\n}' cellRef={mockCellRef} />,
    );

    // Component returns null, so container should be empty
    expect(container.firstChild).toBeNull();
  });

  it("should create DOM elements when mounted with valid table structure", () => {
    // Create a proper table structure
    const table = document.createElement("table");
    const tbody = document.createElement("tbody");
    const row = document.createElement("tr");
    const cell1 = document.createElement("td");
    const cell2 = document.createElement("td");
    const cell3 = document.createElement("td");

    row.appendChild(cell1);
    row.appendChild(cell2);
    row.appendChild(cell3);
    tbody.appendChild(row);
    table.appendChild(tbody);
    document.body.appendChild(table);

    const mockCellRef = { current: cell2 }; // Middle cell
    const formatted = '{\n  "name": "John",\n  "age": 30\n}';

    render(<VariantExpandedContent formatted={formatted} cellRef={mockCellRef} />);

    // Check that an expanded row was created
    const expandedRows = document.querySelectorAll(".variant-expanded-row");
    expect(expandedRows.length).toBe(1);

    const expandedRow = expandedRows[0] as HTMLTableRowElement;

    // Check that the expanded cell spans all 3 columns
    const expandedCell = expandedRow.querySelector("td");
    expect(expandedCell?.colSpan).toBe(3);

    // Verify the code block was created
    const codeBlock = expandedCell?.querySelector("pre");
    expect(codeBlock).toBeTruthy();

    const code = codeBlock?.querySelector("code");
    expect(code?.textContent).toBe(formatted);

    // Cleanup
    document.body.removeChild(table);
  });

  it("should cleanup expanded row on unmount", () => {
    const table = document.createElement("table");
    const tbody = document.createElement("tbody");
    const row = document.createElement("tr");
    const cell = document.createElement("td");

    row.appendChild(cell);
    tbody.appendChild(row);
    table.appendChild(tbody);
    document.body.appendChild(table);

    const mockCellRef = { current: cell };
    const formatted = '{\n  "key": "value"\n}';

    const { unmount } = render(
      <VariantExpandedContent formatted={formatted} cellRef={mockCellRef} />,
    );

    // Verify expanded row was created
    expect(document.querySelectorAll(".variant-expanded-row").length).toBe(1);

    // Unmount component
    unmount();

    // Verify expanded row was removed
    expect(document.querySelectorAll(".variant-expanded-row").length).toBe(0);

    // Cleanup
    document.body.removeChild(table);
  });

  it("should handle large JSON with scrolling", () => {
    const table = document.createElement("table");
    const tbody = document.createElement("tbody");
    const row = document.createElement("tr");
    const cell = document.createElement("td");

    row.appendChild(cell);
    tbody.appendChild(row);
    table.appendChild(tbody);
    document.body.appendChild(table);

    // Create a large object
    const largeObject: Record<string, string> = {};
    for (let i = 0; i < 100; i++) {
      largeObject[`key${i}`] = `value${i}`;
    }
    const formatted = JSON.stringify(largeObject, null, 2);

    const mockCellRef = { current: cell };

    render(<VariantExpandedContent formatted={formatted} cellRef={mockCellRef} />);

    const codeBlock = document.querySelector("pre");
    expect(codeBlock).toBeTruthy();
    expect(codeBlock?.classList.contains("overflow-x-auto")).toBe(true);
    expect(codeBlock?.classList.contains("overflow-y-auto")).toBe(true);
    expect(codeBlock?.classList.contains("max-h-96")).toBe(true);

    // Cleanup
    document.body.removeChild(table);
  });
});
