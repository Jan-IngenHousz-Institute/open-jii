import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { StripPopoverControl } from "./strip-popover-control";
import { StripShadowProvider } from "./strip-shadow-context";

describe("StripPopoverControl", () => {
  it("opens its popover on trigger click and surfaces children", async () => {
    const user = userEvent.setup();
    render(
      <StripPopoverControl label="Dataset">
        <div>popover body</div>
      </StripPopoverControl>,
    );

    expect(screen.queryByText("popover body")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /dataset/i }));
    expect(await screen.findByText("popover body")).toBeInTheDocument();
  });

  it("renders the children when controlled `open` is true", () => {
    render(
      <StripPopoverControl label="Dataset" open={true} onOpenChange={vi.fn()}>
        <div>popover body</div>
      </StripPopoverControl>,
    );
    expect(screen.getByText("popover body")).toBeInTheDocument();
  });

  it("fires onOpenChange when the trigger is clicked", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <StripPopoverControl label="Dataset" open={false} onOpenChange={onOpenChange}>
        <div>popover body</div>
      </StripPopoverControl>,
    );
    await user.click(screen.getByRole("button", { name: /dataset/i }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("short-circuits to a bare trigger inside the shadow row (no popover content rendered)", () => {
    const { container } = render(
      <StripShadowProvider value={true}>
        <StripPopoverControl label="Dataset" open={true} onOpenChange={vi.fn()}>
          <div>popover body</div>
        </StripPopoverControl>
      </StripShadowProvider>,
    );

    // A bare measurement-only button is rendered (aria-hidden, so it stays
    // out of the accessibility tree) but the popover content is NOT — even
    // with `open={true}` — so the live row's content doesn't compete for
    // focus / click-outside with the off-screen copy.
    const button = container.querySelector("button[aria-hidden='true']");
    expect(button).not.toBeNull();
    expect(button?.textContent).toMatch(/dataset/i);
    expect(screen.queryByText("popover body")).not.toBeInTheDocument();
  });
});
