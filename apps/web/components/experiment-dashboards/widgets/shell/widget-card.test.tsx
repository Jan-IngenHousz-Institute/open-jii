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

  it("is non-interactive (no tabIndex) when onSelect is not provided", () => {
    const { container } = render(<WidgetCard>x</WidgetCard>);
    const card = container.querySelector("[data-dashboard-widget]");
    expect(card).not.toHaveAttribute("tabindex");
    expect(card).not.toHaveAttribute("aria-current");
  });

  it("exposes aria-current when interactive and selected", () => {
    const { container } = render(
      <WidgetCard onSelect={vi.fn()} isSelected>
        x
      </WidgetCard>,
    );
    const card = container.querySelector("[data-dashboard-widget]");
    expect(card).toHaveAttribute("aria-current", "true");
    expect(card).toHaveAttribute("tabindex", "0");
  });

  it("fires onSelect on click and stops propagation into the parent", async () => {
    const onSelect = vi.fn();
    const onParentClick = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <div onClick={onParentClick}>
        <WidgetCard onSelect={onSelect}>content</WidgetCard>
      </div>,
    );
    const card = container.querySelector<HTMLDivElement>("[data-dashboard-widget]");
    expect(card).not.toBeNull();
    if (!card) return;
    await user.click(card);
    expect(onSelect).toHaveBeenCalled();
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it("fires onSelect on Enter and Space keypresses", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<WidgetCard onSelect={onSelect}>content</WidgetCard>);

    const card = container.querySelector<HTMLDivElement>("[data-dashboard-widget]");
    expect(card).not.toBeNull();
    if (!card) return;
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
    const { container } = render(<WidgetCard onSelect={onSelect}>content</WidgetCard>);
    const card = container.querySelector<HTMLDivElement>("[data-dashboard-widget]");
    expect(card).not.toBeNull();
    card?.focus();
    expect(onSelect).toHaveBeenCalled();
  });

  it("does not call onSelect on focus when already selected", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <WidgetCard onSelect={onSelect} isSelected>
        content
      </WidgetCard>,
    );
    const card = container.querySelector<HTMLDivElement>("[data-dashboard-widget]");
    expect(card).not.toBeNull();
    card?.focus();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
