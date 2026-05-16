import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { WidgetCard } from "./widget-card";

describe("WidgetCard", () => {
  it("renders children inside the inner frame", () => {
    render(
      <WidgetCard>
        <span>inner</span>
      </WidgetCard>,
    );
    expect(screen.getByText("inner")).toBeInTheDocument();
  });

  it("is non-interactive (no role/tabIndex) when onSelect is not provided", () => {
    render(<WidgetCard>x</WidgetCard>);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("exposes a button role and aria-pressed state when onSelect is provided", () => {
    render(
      <WidgetCard onSelect={vi.fn()} isSelected>
        x
      </WidgetCard>,
    );
    const card = screen.getByRole("button");
    expect(card).toHaveAttribute("aria-pressed", "true");
  });

  it("fires onSelect on click and stops propagation into the parent", async () => {
    const onSelect = vi.fn();
    const onParentClick = vi.fn();
    const user = userEvent.setup();
    render(
      <div onClick={onParentClick}>
        <WidgetCard onSelect={onSelect}>content</WidgetCard>
      </div>,
    );
    await user.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalled();
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it("fires onSelect on Enter and Space keypresses", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<WidgetCard onSelect={onSelect}>content</WidgetCard>);

    const card = screen.getByRole("button");
    card.focus();
    // Focus auto-selects when not currently selected; clear that initial call.
    onSelect.mockClear();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
    await user.keyboard(" ");
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it("calls onSelect on focus when not already selected", () => {
    const onSelect = vi.fn();
    render(<WidgetCard onSelect={onSelect}>content</WidgetCard>);
    screen.getByRole("button").focus();
    expect(onSelect).toHaveBeenCalled();
  });

  it("does not call onSelect on focus when already selected", () => {
    const onSelect = vi.fn();
    render(
      <WidgetCard onSelect={onSelect} isSelected>
        content
      </WidgetCard>,
    );
    screen.getByRole("button").focus();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
