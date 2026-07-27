import { act, fireEvent, render, screen, userEvent } from "@/test/test-utils";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

import type { CommandCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import { CommandCellComponent } from "./command-cell";

// Plotly cannot run in jsdom; render a stub that exposes the live series.
vi.mock("@repo/ui/components/charts/line-chart", async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal();
  const { createElement } = await import("react");
  return {
    ...actual,
    LineChart: ({ data }: { data: { name: string; y: number[] }[] }) =>
      createElement("div", { "data-testid": "line-chart" }, data.map((s) => s.y.join(",")).join()),
  };
});

function inlineCell(overrides: Partial<CommandCell["payload"]> = {}): CommandCell {
  return {
    id: "cmd-1",
    type: "command",
    isCollapsed: false,
    payload: { format: "string", content: "battery", ...overrides },
  };
}

describe("CommandCellComponent", () => {
  it("renders the command content in an editable field", () => {
    render(<CommandCellComponent cell={inlineCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveValue("battery");
  });

  it("calls onUpdate when the command text changes", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(
      <CommandCellComponent
        cell={inlineCell({ content: "" })}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    );
    await user.type(screen.getByRole("textbox"), "h");
    expect(onUpdate).toHaveBeenCalled();
    const updated = onUpdate.mock.lastCall?.[0] as CommandCell;
    expect(updated.payload).toMatchObject({ content: "h" });
  });

  it("shows a validation error for malformed JSON content", () => {
    render(
      <CommandCellComponent
        cell={inlineCell({ format: "json", content: "{not json" })}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText(/.+/, { selector: "p.text-red-500" })).toBeInTheDocument();
  });

  it("toggles collapse through the cell wrapper", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(<CommandCellComponent cell={inlineCell()} onUpdate={onUpdate} onDelete={vi.fn()} />);

    const collapseBtn = document.querySelector("svg.lucide-chevron-down")?.closest("button");
    if (!collapseBtn) throw new Error("collapse toggle not found");
    await user.click(collapseBtn);

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "cmd-1", isCollapsed: true }),
    );
  });

  it("copies the command content to the clipboard", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    render(
      <CommandCellComponent
        cell={inlineCell({ content: "battery" })}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const copyBtn = document.querySelector("svg.lucide-copy")?.closest("button");
    if (!copyBtn) throw new Error("copy button not found");
    await user.click(copyBtn);

    expect(writeText).toHaveBeenCalledWith("battery");
  });

  it("hides the format selector in read-only mode", () => {
    const { rerender } = render(
      <CommandCellComponent cell={inlineCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(screen.getByLabelText("Command format")).toBeInTheDocument();

    rerender(
      <CommandCellComponent cell={inlineCell()} onUpdate={vi.fn()} onDelete={vi.fn()} readOnly />,
    );
    expect(screen.queryByLabelText("Command format")).not.toBeInTheDocument();
  });

  describe("live capture", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    function startButton() {
      return document.querySelector("svg.lucide-activity")?.closest("button") ?? null;
    }
    function stopButton() {
      return document.querySelector("svg.lucide-square")?.closest("button") ?? null;
    }
    async function flush() {
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
    }

    it("loops the read on the interval, charting each sample, until stopped", async () => {
      const onLiveRead = vi
        .fn<() => Promise<unknown>>()
        .mockResolvedValueOnce(340.5)
        .mockResolvedValueOnce(341.5)
        .mockResolvedValue(342.5);
      render(
        <CommandCellComponent
          cell={inlineCell({ content: "par" })}
          onUpdate={vi.fn()}
          onDelete={vi.fn()}
          onLiveRead={onLiveRead}
          isDeviceConnected
        />,
      );

      const start = startButton();
      if (!start) throw new Error("live start button not found");
      expect(start).toBeEnabled();
      fireEvent.click(start);
      await flush();

      // First read fires immediately on start.
      expect(onLiveRead).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("live-capture-panel")).toBeInTheDocument();
      expect(screen.getByTestId("line-chart")).toHaveTextContent("340.5");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(onLiveRead).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId("line-chart")).toHaveTextContent("340.5,341.5");

      const stop = stopButton();
      if (!stop) throw new Error("live stop button not found");
      fireEvent.click(stop);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      // The loop halted; captured points stay on screen.
      expect(onLiveRead).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId("line-chart")).toHaveTextContent("340.5,341.5");
    });

    it("disables Start when no device is connected", () => {
      render(
        <CommandCellComponent
          cell={inlineCell({ content: "par" })}
          onUpdate={vi.fn()}
          onDelete={vi.fn()}
          onLiveRead={vi.fn()}
          isDeviceConnected={false}
        />,
      );
      expect(startButton()).toBeDisabled();
    });

    it("offers live capture only for string-format cells with device access", () => {
      const { rerender } = render(
        <CommandCellComponent
          cell={inlineCell({ format: "json", content: '["par"]' })}
          onUpdate={vi.fn()}
          onDelete={vi.fn()}
          onLiveRead={vi.fn()}
          isDeviceConnected
        />,
      );
      expect(startButton()).toBeNull();

      rerender(<CommandCellComponent cell={inlineCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />);
      expect(startButton()).toBeNull();
    });
  });
});
