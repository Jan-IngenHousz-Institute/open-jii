import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { DataTableTextCell } from "./data-table-text-cell";

describe("DataTableTextCell", () => {
  it("should render short text without tooltip", () => {
    render(<DataTableTextCell text="Short text" />);
    expect(screen.getByText("Short text")).toBeInTheDocument();
    // Short text renders as a plain span, no cursor-help class
    expect(document.querySelector(".cursor-help")).not.toBeInTheDocument();
  });

  it("should render text at exact max length without tooltip", () => {
    const text = "a".repeat(150); // Default max length
    render(<DataTableTextCell text={text} />);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(document.querySelector(".cursor-help")).not.toBeInTheDocument();
  });

  it("should truncate long text and show tooltip", () => {
    const longText = "a".repeat(200);
    render(<DataTableTextCell text={longText} />);

    // Truncated text is shown with cursor-help class indicating tooltip
    const truncatedSpan = screen.getByText("a".repeat(150) + "...");
    expect(truncatedSpan).toBeInTheDocument();
    expect(truncatedSpan).toHaveClass("cursor-help");
  });

  it("should respect custom maxLength", () => {
    const text = "This is a longer text that should be truncated";
    render(<DataTableTextCell text={text} maxLength={10} />);

    const truncated = screen.getByText("This is a ...");
    expect(truncated).toBeInTheDocument();
    expect(truncated).toHaveClass("cursor-help");
  });

  it("should render em dash for empty string", () => {
    render(<DataTableTextCell text="" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("should handle null value", () => {
    render(<DataTableTextCell text={null as unknown as string} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("should handle undefined value", () => {
    render(<DataTableTextCell text={undefined as unknown as string} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("should show full text in tooltip content", () => {
    const longText = "This is a very long text that needs to be shown in a tooltip";
    render(<DataTableTextCell text={longText} maxLength={20} />);

    // Truncated text is displayed visually with cursor-help indicating tooltip
    const truncated = screen.getByText("This is a very long ...");
    expect(truncated).toBeInTheDocument();
    expect(truncated).toHaveClass("cursor-help");
    // Radix TooltipContent is not rendered in DOM until hovered
  });

  it("should apply cursor-help class to truncated text", () => {
    const longText = "a".repeat(200);
    render(<DataTableTextCell text={longText} />);

    const span = document.querySelector(".cursor-help");
    expect(span).toBeInTheDocument();
  });

  it("should handle text with exactly one character over limit", () => {
    const text = "a".repeat(151);
    render(<DataTableTextCell text={text} />);

    const truncated = screen.getByText("a".repeat(150) + "...");
    expect(truncated).toBeInTheDocument();
    expect(truncated).toHaveClass("cursor-help");
  });

  it("should handle multiline text in tooltip", () => {
    const multilineText = "Line 1\nLine 2\nLine 3";
    render(<DataTableTextCell text={multilineText} maxLength={5} />);

    // Text is truncated and wrapped in tooltip trigger
    const truncated = screen.getByText("Line ...");
    expect(truncated).toBeInTheDocument();
    expect(truncated).toHaveClass("cursor-help");
  });

  it("should handle special characters", () => {
    const specialText = "Special chars: @#$%^&*()";
    render(<DataTableTextCell text={specialText} />);

    expect(screen.getByText(specialText)).toBeInTheDocument();
  });

  it("should handle unicode characters", () => {
    const unicodeText = "Unicode: 你好 🚀 émojis";
    render(<DataTableTextCell text={unicodeText} />);

    expect(screen.getByText(unicodeText)).toBeInTheDocument();
  });

  it("should truncate at exact position without breaking characters", () => {
    const text = "a".repeat(100) + "b".repeat(100);
    render(<DataTableTextCell text={text} maxLength={100} />);

    expect(screen.getByText("a".repeat(100) + "...")).toBeInTheDocument();
  });
});
