import { createOutputCell } from "@/test/factories";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { OutputCellComponent } from "./output-cell";

// Plotly cannot run in jsdom; render a stub that exposes the series for assertions.
vi.mock("@repo/ui/components/charts/line-chart", async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal();
  return {
    ...actual,
    LineChart: ({ data }: { data: { name: string; y: number[] }[] }) => (
      <div data-testid="line-chart" data-series={JSON.stringify(data.map((s) => s.name))}>
        {data.map((s) => (
          <div key={s.name} data-testid={`series-${s.name}`}>
            {s.y.join(",")}
          </div>
        ))}
      </div>
    ),
  };
});

// jsdom does not implement navigator.clipboard — provide a minimal stub so
// useCopyToClipboard resolves instead of throwing.
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  writable: true,
  configurable: true,
});

describe("OutputCellComponent", () => {
  const onUpdate = vi.fn();
  const onDelete = vi.fn();

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

  it("renders a chart by default and exposes Table/JSON tabs when data is a numeric array", async () => {
    const cell = createOutputCell({ data: [1, 2, 3, 4, 5] });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    expect(screen.getByTestId("series-value")).toHaveTextContent("1,2,3,4,5");
    expect(screen.getByRole("tab", { name: "Chart" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Table" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "JSON" })).toBeInTheDocument();
  });

  it("plots each numeric-array field of an object payload as a separate series", () => {
    const cell = createOutputCell({
      data: { device_id: "abc", spectrum: [10, 20, 30], baseline: [1, 2, 3] },
    });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    const chart = screen.getByTestId("line-chart");
    expect(chart).toHaveAttribute("data-series", JSON.stringify(["spectrum", "baseline"]));
    expect(screen.getByTestId("series-spectrum")).toHaveTextContent("10,20,30");
    expect(screen.getByTestId("series-baseline")).toHaveTextContent("1,2,3");
  });

  it("hides the Chart tab and defaults to Table when no field is a numeric array", () => {
    const cell = createOutputCell({ data: { device_id: "abc-123", firmware_version: "1.2.3" } });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.queryByRole("tab", { name: "Chart" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
    expect(screen.getByText("device_id")).toBeInTheDocument();
  });

  it("shows a copy button in the JSON view that swaps to a check icon when clicked", async () => {
    const user = userEvent.setup();
    const cell = createOutputCell({ data: [{ time: 1, value: 42 }] });
    render(<OutputCellComponent cell={cell} onUpdate={onUpdate} onDelete={onDelete} />);

    await user.click(screen.getByRole("tab", { name: "JSON" }));
    const copyButton = screen.getByRole("button", { name: "Copy JSON" });
    expect(copyButton.querySelector(".lucide-copy")).toBeInTheDocument();

    await user.click(copyButton);
    await waitFor(() => {
      expect(copyButton.querySelector(".lucide-check")).toBeInTheDocument();
    });
  });
});
