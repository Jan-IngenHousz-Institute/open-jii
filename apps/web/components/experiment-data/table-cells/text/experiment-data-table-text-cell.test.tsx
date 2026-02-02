import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ExperimentDataTableTextCell } from "./experiment-data-table-text-cell";

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({
    children,
    asChild: _asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <div data-testid="tooltip-trigger">{children}</div>,
  TooltipContent: ({
    children,
    className: _className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div data-testid="tooltip-content">{children}</div>,
}));

describe("ExperimentDataTableTextCell", () => {
  it("should render short text without tooltip", () => {
    render(<ExperimentDataTableTextCell text="Short text" />);
    expect(screen.getByText("Short text")).toBeInTheDocument();
    expect(screen.queryByTestId("tooltip-trigger")).not.toBeInTheDocument();
  });

  it("should render text at exact max length without tooltip", () => {
    const text = "a".repeat(150); // Default max length
    render(<ExperimentDataTableTextCell text={text} />);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByTestId("tooltip-trigger")).not.toBeInTheDocument();
  });

  it("should truncate long text and show tooltip", () => {
    const longText = "a".repeat(200);
    render(<ExperimentDataTableTextCell text={longText} />);

    expect(screen.getByTestId("tooltip-trigger")).toBeInTheDocument();
    expect(screen.getByText("a".repeat(150) + "...")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip-content")).toBeInTheDocument();
  });

  it("should respect custom maxLength", () => {
    const text = "This is a longer text that should be truncated";
    render(<ExperimentDataTableTextCell text={text} maxLength={10} />);

    expect(screen.getByText("This is a ...")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip-trigger")).toBeInTheDocument();
  });

  it("should render em dash for empty string", () => {
    render(<ExperimentDataTableTextCell text="" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("should handle null value", () => {
    render(<ExperimentDataTableTextCell text={null as unknown as string} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("should handle undefined value", () => {
    render(<ExperimentDataTableTextCell text={undefined as unknown as string} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("should show full text in tooltip content", () => {
    const longText = "This is a very long text that needs to be shown in a tooltip";
    render(<ExperimentDataTableTextCell text={longText} maxLength={20} />);

    const tooltipContent = screen.getByTestId("tooltip-content");
    expect(tooltipContent).toHaveTextContent(longText);
  });

  it("should apply cursor-help class to truncated text", () => {
    const longText = "a".repeat(200);
    render(<ExperimentDataTableTextCell text={longText} />);

    const trigger = screen.getByTestId("tooltip-trigger");
    expect(trigger.querySelector(".cursor-help")).toBeInTheDocument();
  });

  it("should handle text with exactly one character over limit", () => {
    const text = "a".repeat(151);
    render(<ExperimentDataTableTextCell text={text} />);

    expect(screen.getByText("a".repeat(150) + "...")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip-trigger")).toBeInTheDocument();
  });

  it("should handle multiline text in tooltip", () => {
    const multilineText = "Line 1\nLine 2\nLine 3";
    render(<ExperimentDataTableTextCell text={multilineText} maxLength={5} />);

    const tooltipContent = screen.getByTestId("tooltip-content");
    // In HTML, newlines are rendered as spaces, so check that all lines are present
    expect(tooltipContent.textContent).toContain("Line 1");
    expect(tooltipContent.textContent).toContain("Line 2");
    expect(tooltipContent.textContent).toContain("Line 3");
  });

  it("should handle special characters", () => {
    const specialText = "Special chars: @#$%^&*()";
    render(<ExperimentDataTableTextCell text={specialText} />);

    expect(screen.getByText(specialText)).toBeInTheDocument();
  });

  it("should handle unicode characters", () => {
    const unicodeText = "Unicode: 你好 🚀 émojis";
    render(<ExperimentDataTableTextCell text={unicodeText} />);

    expect(screen.getByText(unicodeText)).toBeInTheDocument();
  });

  it("should truncate at exact position without breaking characters", () => {
    const text = "a".repeat(100) + "b".repeat(100);
    render(<ExperimentDataTableTextCell text={text} maxLength={100} />);

    expect(screen.getByText("a".repeat(100) + "...")).toBeInTheDocument();
  });
});
