import { render, screen, userEvent } from "@/test/test-utils";
import { Code } from "lucide-react";
import { describe, it, expect, vi } from "vitest";

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

    // Click collapse button (first button in the header)
    const buttons = screen.getAllByRole("button");
    const collapseButton = buttons[0];
    await user.click(collapseButton);

    expect(onToggleCollapse).toHaveBeenCalledWith(true);
  });

  it("hides children when isCollapsed is true", () => {
    renderWrapper({ isCollapsed: true });

    // The content should be hidden via Collapsible
    expect(screen.queryByTestId("cell-content")).not.toBeInTheDocument();
  });

  it("shows running spinner when executionStatus is 'running'", () => {
    renderWrapper({ executionStatus: "running" });

    // The Loader2 spinner should be present (animated)
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("shows completed checkmark when executionStatus is 'completed'", () => {
    renderWrapper({ executionStatus: "completed" });

    // CheckCircle2 with emerald color
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

    // In readOnly mode, the delete and run buttons should not be rendered
    const buttons = screen.getAllByRole("button");
    // Only the collapse toggle should be present
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
});
