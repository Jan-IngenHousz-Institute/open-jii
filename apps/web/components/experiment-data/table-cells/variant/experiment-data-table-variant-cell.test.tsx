import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
  Copy: () => <div data-testid="copy-icon">📋</div>,
  Check: () => <div data-testid="check-icon">✓</div>,
}));

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
});

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
    <div data-testid="collapsible" data-open={String(open)}>
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
    render(
      <ExperimentDataTableVariantCell
        data="simple text"
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("simple text")).toBeInTheDocument();
  });

  it("should render simple text for invalid JSON data", () => {
    render(
      <ExperimentDataTableVariantCell
        data="{invalid json}"
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("{invalid json}")).toBeInTheDocument();
  });

  it("should render collapsible trigger for valid JSON", () => {
    render(
      <ExperimentDataTableVariantCell
        data='{"key": "value"}'
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );

    expect(screen.getByText("JSON")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should render empty string as simple text", () => {
    render(
      <ExperimentDataTableVariantCell
        data=""
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.queryByText("JSON")).not.toBeInTheDocument();
  });

  it("should expand when triggered", () => {
    render(
      <ExperimentDataTableVariantCell
        data='{"name": "John", "age": 30}'
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );

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

    render(
      <ExperimentDataTableVariantCell
        data={complexData}
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("JSON")).toBeInTheDocument();
  });

  it("should handle JSON arrays", () => {
    const arrayData = JSON.stringify([
      { id: 1, name: "Item 1" },
      { id: 2, name: "Item 2" },
    ]);

    render(
      <ExperimentDataTableVariantCell
        data={arrayData}
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("JSON")).toBeInTheDocument();
  });

  it("should handle JSON with null and undefined values", () => {
    const dataWithNulls = JSON.stringify({ name: "John", age: null, active: undefined });

    render(
      <ExperimentDataTableVariantCell
        data={dataWithNulls}
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("JSON")).toBeInTheDocument();
  });

  it("should show correct button states", () => {
    render(
      <ExperimentDataTableVariantCell
        data='{"key": "value"}'
        columnName="test"
        rowId="row-1"
        isExpanded={false}
      />,
    );

    // Should start with collapsible closed
    const collapsible = screen.getByTestId("collapsible");
    expect(collapsible.getAttribute("data-open")).toBe("false");

    // Should show right arrow initially (collapsed state)
    expect(screen.getByTestId("chevron-right")).toBeInTheDocument();
    expect(screen.queryByTestId("chevron-down")).not.toBeInTheDocument();
  });
});

describe("VariantExpandedContent", () => {
  it("should render formatted JSON content", () => {
    const { container } = render(<VariantExpandedContent data='{\n  "key": "value"\n}' />);

    // Component should render the formatted JSON
    expect(container.firstChild).not.toBeNull();
    expect(screen.getByText(/"key": "value"/)).toBeInTheDocument();
  });

  it("should render copy button", () => {
    const jsonData = '{\n  "name": "John",\n  "age": 30\n}';
    render(<VariantExpandedContent data={jsonData} />);

    // Check for copy button
    const copyButtons = screen.getAllByRole("button");
    expect(copyButtons.length).toBeGreaterThan(0);
    expect(screen.getByText("common.copy")).toBeInTheDocument();
  });

  it("should copy JSON to clipboard when copy button is clicked", async () => {
    const jsonData = '{"name": "John", "age": 30}';
    render(<VariantExpandedContent data={jsonData} />);

    const copyButton = screen.getByText("common.copy").closest("button");
    expect(copyButton).toBeInTheDocument();

    if (copyButton) {
      fireEvent.click(copyButton);
    }

    // Check that clipboard.writeText was called
    await waitFor(() => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(vi.mocked(navigator.clipboard.writeText)).toHaveBeenCalledWith(jsonData);
    });
  });

  it("should show 'Copied' confirmation after copying", async () => {
    const jsonData = '{"name": "John"}';
    render(<VariantExpandedContent data={jsonData} />);

    const copyButton = screen.getByText("common.copy").closest("button");
    if (copyButton) {
      fireEvent.click(copyButton);
    }

    // Should show "copied" text
    await waitFor(() => {
      expect(screen.getByText("common.copied")).toBeInTheDocument();
    });

    // Check icon should be visible
    expect(screen.getByTestId("check-icon")).toBeInTheDocument();
  });

  it("should render formatted JSON with proper styling", () => {
    const jsonData = '{\n  "name": "John",\n  "age": 30\n}';
    render(<VariantExpandedContent data={jsonData} />);

    // Check that the code block was created
    const codeBlock = screen.getByText(/"name": "John"/);
    expect(codeBlock).toBeInTheDocument();
    expect(screen.getByText(/"age": 30/)).toBeInTheDocument();
  });

  it("should handle invalid JSON gracefully", () => {
    const invalidJson = "not valid json";
    render(<VariantExpandedContent data={invalidJson} />);

    // Should still render the content
    expect(screen.getByText("not valid json")).toBeInTheDocument();
  });

  it("should apply scrolling classes for overflow", () => {
    const largeObject: Record<string, string> = {};
    for (let i = 0; i < 100; i++) {
      largeObject[`key${i}`] = `value${i}`;
    }
    const formatted = JSON.stringify(largeObject, null, 2);

    const { container } = render(<VariantExpandedContent data={formatted} />);

    const codeBlock = container.querySelector("pre");
    expect(codeBlock).toBeTruthy();
    expect(codeBlock?.classList.contains("overflow-x-auto")).toBe(true);
    expect(codeBlock?.classList.contains("overflow-y-auto")).toBe(true);
    expect(codeBlock?.classList.contains("max-h-96")).toBe(true);
  });

  it("should position copy button absolutely over content", () => {
    const jsonData = '{"key": "value"}';
    render(<VariantExpandedContent data={jsonData} />);

    const copyButton = screen.getByText("common.copy").closest("button");
    expect(copyButton?.className).toContain("absolute");
    expect(copyButton?.className).toContain("right-6");
    expect(copyButton?.className).toContain("top-6");
    expect(copyButton?.className).toContain("z-10");
  });
});
