import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import {
  ExperimentDataTableVariantCell,
  VariantExpandedContent,
} from "./experiment-data-table-variant-cell";

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
});

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

  it("should expand when triggered", async () => {
    const user = userEvent.setup();
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
    await user.click(screen.getByRole("button"));

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

  it("should render button in collapsed state", () => {
    render(
      <ExperimentDataTableVariantCell
        data='{"key": "value"}'
        columnName="test"
        rowId="row-1"
        isExpanded={false}
      />,
    );

    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByText("JSON")).toBeInTheDocument();
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
    const user = userEvent.setup();
    const jsonData = '{"name": "John", "age": 30}';
    render(<VariantExpandedContent data={jsonData} />);

    const copyButton = screen.getByText("common.copy").closest("button");
    expect(copyButton).toBeInTheDocument();

    if (copyButton) {
      await user.click(copyButton);
    }

    // Check that clipboard.writeText was called
    await waitFor(() => {
      expect(vi.mocked(navigator.clipboard.writeText)).toHaveBeenCalledWith(jsonData);
    });
  });

  it("should show 'Copied' confirmation after copying", async () => {
    const user = userEvent.setup();
    const jsonData = '{"name": "John"}';
    render(<VariantExpandedContent data={jsonData} />);

    const copyButton = screen.getByText("common.copy").closest("button");
    if (copyButton) {
      await user.click(copyButton);
    }

    // Should show "copied" text
    await waitFor(() => {
      expect(screen.getByText("common.copied")).toBeInTheDocument();
    });
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
    expect(copyButton?.className).toContain("right-12");
    expect(copyButton?.className).toContain("top-8");
    expect(copyButton?.className).toContain("z-1");
  });
});
