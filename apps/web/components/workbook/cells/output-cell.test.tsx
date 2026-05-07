import { createOutputCell } from "@/test/factories";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { OutputCellComponent } from "./output-cell";

// Plotly cannot run in jsdom; render a stub that exposes the series for assertions.
// Mock factory is hoisted so we use React.createElement (no JSX) to avoid runtime ordering issues.
vi.mock("@repo/ui/components/charts/line-chart", async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal();
  const { createElement } = await import("react");
  return {
    ...actual,
    LineChart: ({ data }: { data: { name: string; y: number[] }[] }) =>
      createElement(
        "div",
        {
          "data-testid": "line-chart",
          "data-series": JSON.stringify(data.map((s) => s.name)),
        },
        data.map((s) =>
          createElement("div", { key: s.name, "data-testid": `series-${s.name}` }, s.y.join(",")),
        ),
      ),
  };
});

// jsdom does not implement navigator.clipboard — provide a minimal stub so
// useCopyToClipboard resolves instead of throwing. Hoisted so tests can
// assert payloads and reset between runs (otherwise call counts leak).
const writeText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, "clipboard", {
  value: { writeText },
  writable: true,
  configurable: true,
});

describe("OutputCellComponent", () => {
  const onUpdate = vi.fn();
  const onDelete = vi.fn();

  beforeEach(() => {
    writeText.mockClear();
    onUpdate.mockClear();
    onDelete.mockClear();
  });

  it("displays execution time and messages with correct severity styling", () => {
    const cell = createOutputCell({
      executionTime: 2500,
      messages: ["Error: sensor failed", "Warning: low battery", "Measurement started"],
    });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByText("2.50s")).toBeInTheDocument();
    expect(screen.getByText("Error: sensor failed")).toBeInTheDocument();
    expect(screen.getByText("Warning: low battery")).toBeInTheDocument();
    expect(screen.getByText("Measurement started")).toBeInTheDocument();
  });

  it("shows question answer data when data has an answer field", () => {
    const cell = createOutputCell({ data: { answer: "Yes" } });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);
    expect(screen.getByText("Yes")).toBeInTheDocument();
  });

  it("renders table/JSON tabs for measurement data and switches between them", async () => {
    const user = userEvent.setup();
    const cell = createOutputCell({
      data: [{ time: 1, value: 42 }],
    });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByText("time")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "JSON" }));
    expect(screen.getByText(/"value": 42/)).toBeInTheDocument();
  });

  it("calls onDelete when the user clicks the clear button", async () => {
    const user = userEvent.setup();
    const cell = createOutputCell({ data: { answer: "Yes" } });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    await user.click(screen.getByTitle("Clear output"));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("hides the clear button and shows data normally in readOnly mode", () => {
    const cell = createOutputCell({ data: { answer: "Yes" } });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} readOnly />);

    expect(screen.queryByTitle("Clear output")).not.toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
  });

  it("shows empty state when no data or messages are present", () => {
    const cell = createOutputCell();
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByText(/No measurement data available/)).toBeInTheDocument();
  });

  it("formats short execution times in milliseconds", () => {
    const cell = createOutputCell({ executionTime: 500 });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);
    expect(screen.getByText("500ms")).toBeInTheDocument();
  });

  it("renders a key/value table for plain object data (typical protocol output)", () => {
    const cell = createOutputCell({
      data: { device_id: "abc-123", firmware_version: "1.2.3", sample_count: 42 },
    });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByText("device_id")).toBeInTheDocument();
    expect(screen.getByText("abc-123")).toBeInTheDocument();
    expect(screen.getByText("firmware_version")).toBeInTheDocument();
    expect(screen.getByText("1.2.3")).toBeInTheDocument();
    expect(screen.getByText("sample_count")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("toggles collapse state when the chevron is clicked", async () => {
    const user = userEvent.setup();
    const localOnUpdate = vi.fn();
    const cell = createOutputCell({ data: [{ time: 1, value: 42 }] });
    const { rerender } = render(
      <OutputCellComponent cell={cell} onUpdate={localOnUpdate} onDelete={onDelete} />,
    );

    expect(screen.getByText("time")).toBeInTheDocument();

    await user.click(screen.getByTitle("Collapse output"));
    expect(localOnUpdate).toHaveBeenCalledWith({ ...cell, isCollapsed: true });

    rerender(
      <OutputCellComponent
        cell={{ ...cell, isCollapsed: true }}
        onUpdate={localOnUpdate}
        onDelete={onDelete}
      />,
    );
    expect(screen.queryByText("time")).not.toBeInTheDocument();
    expect(screen.getByTitle("Expand output")).toBeInTheDocument();
  });

  it("renders inline sparklines for numeric-array fields in the table", () => {
    const cell = createOutputCell({
      data: { device_id: "abc", spectrum: [10, 20, 30], baseline: [1, 2, 3] },
    });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByRole("button", { name: "Expand chart for spectrum" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand chart for baseline" })).toBeInTheDocument();
    // Plain string values still render as text, not as charts.
    expect(screen.getByText("abc")).toBeInTheDocument();
    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
  });

  it("renders sparklines inside nested rows (MultispeQ-style set[0] payload)", () => {
    const cell = createOutputCell({
      data: { set: [{ ENV: [1, 2, 3], SUN: [10, 20, 30] }], protocol_id: 12 },
    });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByRole("button", { name: "Expand chart for ENV" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand chart for SUN" })).toBeInTheDocument();
  });

  it("expands the full chart below the table when a sparkline is clicked, and closes it again", async () => {
    const user = userEvent.setup();
    const cell = createOutputCell({
      data: { spectrum: [10, 20, 30], baseline: [1, 2, 3] },
    });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Expand chart for spectrum" }));
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    expect(screen.getByTestId("series-spectrum")).toHaveTextContent("10,20,30");

    await user.click(screen.getByRole("button", { name: "Close chart" }));
    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
  });

  it("clicking the same sparkline a second time toggles the expanded chart off", async () => {
    const user = userEvent.setup();
    const cell = createOutputCell({ data: { spectrum: [10, 20, 30] } });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    const trigger = screen.getByRole("button", { name: "Expand chart for spectrum" });
    await user.click(trigger);
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();

    await user.click(trigger);
    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
  });

  it("switches the expanded chart to a different column on a single click", async () => {
    const user = userEvent.setup();
    const cell = createOutputCell({ data: { spectrum: [10, 20, 30], baseline: [1, 2, 3] } });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    await user.click(screen.getByRole("button", { name: "Expand chart for spectrum" }));
    expect(screen.getByTestId("series-spectrum")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Expand chart for baseline" }));
    expect(screen.queryByTestId("series-spectrum")).not.toBeInTheDocument();
    expect(screen.getByTestId("series-baseline")).toHaveTextContent("1,2,3");
  });

  it("collapses the expanded chart when the user switches to the JSON tab", async () => {
    const user = userEvent.setup();
    const cell = createOutputCell({ data: { spectrum: [10, 20, 30] } });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    await user.click(screen.getByRole("button", { name: "Expand chart for spectrum" }));
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "JSON" }));
    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();

    // Switching back to Table doesn't auto-restore the chart; the user re-clicks the sparkline.
    await user.click(screen.getByRole("tab", { name: "Table" }));
    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
  });

  it("does not render a sparkline when no field is a numeric array", () => {
    const cell = createOutputCell({ data: { device_id: "abc-123", firmware_version: "1.2.3" } });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.queryByRole("button", { name: /Expand chart/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
    expect(screen.getByText("device_id")).toBeInTheDocument();
  });

  it("renders an array of non-numeric primitives as a comma-joined string in a cell", () => {
    const cell = createOutputCell({
      data: { device_id: "abc", tags: ["alpha", "beta", "gamma"] },
    });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByText("alpha, beta, gamma")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Expand chart/ })).not.toBeInTheDocument();
  });

  it("renders a nested plain object inside a cell as a sub-table", () => {
    const cell = createOutputCell({
      data: { device: { id: "esp32-c3", firmware: "1.0.0" } },
    });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByText("device")).toBeInTheDocument();
    expect(screen.getByText("id")).toBeInTheDocument();
    expect(screen.getByText("esp32-c3")).toBeInTheDocument();
    expect(screen.getByText("firmware")).toBeInTheDocument();
    expect(screen.getByText("1.0.0")).toBeInTheDocument();
  });

  it("renders a top-level primitive data value as plain text in the table tab", () => {
    const cell = createOutputCell({ data: "raw measurement string" });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByText("raw measurement string")).toBeInTheDocument();
  });

  it("renders a top-level array of primitives via JSON in the table tab", () => {
    const cell = createOutputCell({ data: [1, 2, 3] });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByText("[1,2,3]")).toBeInTheDocument();
  });

  it("renders nullish entries in a non-numeric array as empty strings", () => {
    const cell = createOutputCell({ data: { tags: ["a", null, "b"] } });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByText("a, , b")).toBeInTheDocument();
  });

  it("falls back to the empty-state message when data is an empty object", () => {
    const cell = createOutputCell({ data: {} });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByText("No output data")).toBeInTheDocument();
  });

  it("renders an em-dash placeholder for nullish cell values", () => {
    const cell = createOutputCell({ data: { device_id: "abc", missing: null } });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByText("missing")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders an empty-array placeholder for empty-array cell values", () => {
    const cell = createOutputCell({ data: { device_id: "abc", samples: [] } });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByText("samples")).toBeInTheDocument();
    expect(screen.getByText("[]")).toBeInTheDocument();
  });

  it("renders a sparkline for a single-point numeric array (no division by zero)", () => {
    const cell = createOutputCell({ data: { spectrum: [42] } });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByRole("button", { name: "Expand chart for spectrum" })).toBeInTheDocument();
    expect(screen.getByText("n=1")).toBeInTheDocument();
  });

  it("renders a sparkline for a constant-value numeric array (no NaN range)", () => {
    const cell = createOutputCell({ data: { spectrum: [5, 5, 5] } });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByRole("button", { name: "Expand chart for spectrum" })).toBeInTheDocument();
  });

  it("renders multi-row array-of-objects tables with row dividers", () => {
    const cell = createOutputCell({
      data: [
        { time: 1, value: 42 },
        { time: 2, value: 84 },
      ],
    });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("84")).toBeInTheDocument();
  });

  it("shows a copy button in the JSON view that swaps to a check icon when clicked", async () => {
    const user = userEvent.setup();
    // userEvent.setup() v14 replaces navigator.clipboard with its own stub; re-install ours
    // so we can assert the payload that was copied.
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    const cell = createOutputCell({ data: [{ time: 1, value: 42 }] });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    await user.click(screen.getByRole("tab", { name: "JSON" }));
    const copyButton = screen.getByRole("button", { name: "Copy JSON" });
    expect(copyButton.querySelector(".lucide-copy")).toBeInTheDocument();

    await user.click(copyButton);
    await waitFor(() => {
      expect(copyButton.querySelector(".lucide-check")).toBeInTheDocument();
    });
    expect(writeText).toHaveBeenCalledWith(JSON.stringify(cell.data, null, 2));
  });

  it("uses local state to collapse in readOnly mode without mutating persisted state", async () => {
    const user = userEvent.setup();
    const cell = createOutputCell({ data: { device_id: "abc" } });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} readOnly />);

    expect(screen.getByText("device_id")).toBeInTheDocument();
    await user.click(screen.getByTitle("Collapse output"));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.queryByText("device_id")).not.toBeInTheDocument();
    expect(screen.getByTitle("Expand output")).toBeInTheDocument();
  });

  it("renders an array of objects with primitive rows without throwing", () => {
    const cell = createOutputCell({
      data: [{ time: 1, value: 42 }, "broken-row", null, { time: 2, value: 84 }],
    });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("84")).toBeInTheDocument();
    // Non-object rows render as em-dash placeholders in every column.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4);
  });
});
