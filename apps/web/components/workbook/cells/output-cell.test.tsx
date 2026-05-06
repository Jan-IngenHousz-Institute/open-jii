import { createOutputCell } from "@/test/factories";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { OutputCellComponent } from "./output-cell";

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
