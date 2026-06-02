import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ExpandableWidget } from "./expandable-widget";
import { WidgetCard } from "./widget-card";

describe("ExpandableWidget", () => {
  it("renders the inline children", () => {
    render(
      <WidgetCard>
        <ExpandableWidget title="Plot">
          <div>chart body</div>
        </ExpandableWidget>
      </WidgetCard>,
    );
    expect(screen.getByText("chart body")).toBeInTheDocument();
  });

  it("portals the expand affordance into the card's tab slot when present", () => {
    render(
      <WidgetCard>
        <ExpandableWidget title="Plot">
          <div>chart body</div>
        </ExpandableWidget>
      </WidgetCard>,
    );
    expect(screen.getByRole("button", { name: "widget.expand" })).toBeInTheDocument();
  });

  it("renders nothing extra without a card slot context (inline content only)", () => {
    render(
      <ExpandableWidget title="Plot">
        <div>chart body</div>
      </ExpandableWidget>,
    );
    expect(screen.getByText("chart body")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "widget.expand" })).not.toBeInTheDocument();
  });

  it("opens the dialog when the expand button is clicked and shows the title", async () => {
    const user = userEvent.setup();
    render(
      <WidgetCard>
        <ExpandableWidget title="Plot">
          <div>chart body</div>
        </ExpandableWidget>
      </WidgetCard>,
    );

    await user.click(screen.getByRole("button", { name: "widget.expand" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Plot" })).toBeInTheDocument();
  });

  it("falls back to a generic dialog title when the widget title is null", async () => {
    const user = userEvent.setup();
    render(
      <WidgetCard>
        <ExpandableWidget title={null}>
          <div>chart body</div>
        </ExpandableWidget>
      </WidgetCard>,
    );

    await user.click(screen.getByRole("button", { name: "widget.expand" }));
    expect(screen.getByRole("heading", { name: "widget.expandedPreview" })).toBeInTheDocument();
  });
});
