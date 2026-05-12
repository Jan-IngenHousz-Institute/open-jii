import { render, screen, userEvent } from "@/test/test-utils";
import { act, cleanup } from "@testing-library/react";
import { Code } from "lucide-react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { CellWrapper } from "./cell-wrapper";

function renderWrapper(overrides: Partial<Parameters<typeof CellWrapper>[0]> = {}) {
  const defaultProps = {
    icon: <Code className="h-3.5 w-3.5" data-testid="cell-icon" />,
    label: "Test Cell",
    accentColor: "#005E5E",
    children: <div data-testid="cell-content">Cell body content</div>,
    ...overrides,
  };

  return render(<CellWrapper {...defaultProps} />);
}

describe("CellWrapper", () => {
  it("renders the cell label", () => {
    renderWrapper({ label: "Markdown" });
    expect(screen.getByText("Markdown")).toBeInTheDocument();
  });

  it("renders children content when not collapsed", () => {
    renderWrapper();
    expect(screen.getByTestId("cell-content")).toBeInTheDocument();
  });

  it("collapses and expands when the toggle button is clicked", async () => {
    const user = userEvent.setup();
    const onToggleCollapse = vi.fn();

    renderWrapper({ onToggleCollapse });

    const buttons = screen.getAllByRole("button");
    const collapseButton = buttons[0];
    await user.click(collapseButton);

    expect(onToggleCollapse).toHaveBeenCalledWith(true);
  });

  it("hides children when isCollapsed is true", () => {
    renderWrapper({ isCollapsed: true });

    expect(screen.queryByTestId("cell-content")).not.toBeInTheDocument();
  });

  it("shows running spinner when executionStatus is 'running'", () => {
    renderWrapper({ executionStatus: "running" });

    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("shows completed checkmark when executionStatus is 'completed'", () => {
    renderWrapper({ executionStatus: "completed" });

    const checkIcon = document.querySelector(".text-emerald-500");
    expect(checkIcon).toBeInTheDocument();
  });

  it("shows error icon when executionStatus is 'error'", () => {
    renderWrapper({ executionStatus: "error", executionError: "Something went wrong" });

    const errorIcon = document.querySelector(".text-destructive");
    expect(errorIcon).toBeInTheDocument();
  });

  it("hides delete and run buttons in readOnly mode", () => {
    renderWrapper({
      readOnly: true,
      onDelete: vi.fn(),
      onRun: vi.fn(),
    });

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
  });

  it("renders headerActions when not readOnly", () => {
    renderWrapper({
      headerActions: <button data-testid="custom-action">Custom</button>,
    });

    expect(screen.getByTestId("custom-action")).toBeInTheDocument();
  });

  it("hides headerActions in readOnly mode", () => {
    renderWrapper({
      readOnly: true,
      headerActions: <button data-testid="custom-action">Custom</button>,
    });

    expect(screen.queryByTestId("custom-action")).not.toBeInTheDocument();
  });

  it("renders headerBadges", () => {
    renderWrapper({
      headerBadges: <span data-testid="badge">ACTIVE</span>,
    });

    expect(screen.getByTestId("badge")).toBeInTheDocument();
  });

  describe("RunTimer (running cell elapsed time)", () => {
    afterEach(() => {
      cleanup();
      vi.useRealTimers();
    });

    it("renders next to the spinner only while executionStatus is 'running'", () => {
      const { rerender } = renderWrapper({ executionStatus: "running" });
      expect(screen.getByTestId("run-timer")).toBeInTheDocument();

      rerender(
        <CellWrapper
          icon={<Code className="h-3.5 w-3.5" />}
          label="Test Cell"
          accentColor="#005E5E"
          executionStatus="completed"
        >
          <div />
        </CellWrapper>,
      );
      expect(screen.queryByTestId("run-timer")).not.toBeInTheDocument();
    });

    it("ticks the elapsed value as time advances", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      renderWrapper({ executionStatus: "running" });

      // First paint reads 0ms.
      expect(screen.getByTestId("run-timer")).toHaveTextContent("0ms");

      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(screen.getByTestId("run-timer")).toHaveTextContent("300ms");

      act(() => {
        vi.advanceTimersByTime(900);
      });
      // 1.2s formatted with one decimal once we cross the 1s threshold.
      expect(screen.getByTestId("run-timer")).toHaveTextContent("1.2s");

      act(() => {
        vi.advanceTimersByTime(15_000);
      });
      // Past 10s the formatter switches to integer seconds.
      expect(screen.getByTestId("run-timer")).toHaveTextContent("16s");
    });

    it("resets to zero on a fresh running transition", () => {
      vi.useFakeTimers();
      const { rerender } = renderWrapper({ executionStatus: "running" });
      act(() => {
        vi.advanceTimersByTime(2_000);
      });
      expect(screen.getByTestId("run-timer")).toHaveTextContent("2.0s");

      rerender(
        <CellWrapper
          icon={<Code className="h-3.5 w-3.5" />}
          label="Test Cell"
          accentColor="#005E5E"
          executionStatus="completed"
        >
          <div />
        </CellWrapper>,
      );
      // Re-enter running after a completed beat: timer should restart at 0.
      rerender(
        <CellWrapper
          icon={<Code className="h-3.5 w-3.5" />}
          label="Test Cell"
          accentColor="#005E5E"
          executionStatus="running"
        >
          <div />
        </CellWrapper>,
      );
      expect(screen.getByTestId("run-timer")).toHaveTextContent("0ms");
    });

    it("does not render when not running", () => {
      renderWrapper({ executionStatus: "idle" });
      expect(screen.queryByTestId("run-timer")).not.toBeInTheDocument();
    });
  });
});
