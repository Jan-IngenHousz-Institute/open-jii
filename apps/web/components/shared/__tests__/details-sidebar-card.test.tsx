import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { DetailsSidebarCard } from "../details-sidebar-card";

function renderComponent(props: Partial<React.ComponentProps<typeof DetailsSidebarCard>> = {}) {
  const defaultProps: React.ComponentProps<typeof DetailsSidebarCard> = {
    title: "Test Title",
    children: <p>Test children content</p>,
    ...props,
  };

  return render(<DetailsSidebarCard {...defaultProps} />);
}

describe("DetailsSidebarCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the title", () => {
    renderComponent();
    expect(screen.getByText("Test Title")).toBeInTheDocument();
  });

  it("renders children content", () => {
    renderComponent();
    expect(screen.getByText("Test children content")).toBeInTheDocument();
  });

  it("renders with custom title", () => {
    renderComponent({ title: "Custom Card Title" });
    expect(screen.getByText("Custom Card Title")).toBeInTheDocument();
  });

  it("renders the card structure", () => {
    renderComponent();
    expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
    expect(screen.getByText("Test children content")).toBeInTheDocument();
    expect(document.querySelector('[class*="lg:block"]')).toBeInTheDocument();
  });

  it("renders the title inside an h3 element", () => {
    renderComponent({ title: "Heading Title" });
    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading).toHaveTextContent("Heading Title");
  });

  it("starts in collapsed state by default", () => {
    renderComponent();
    expect(document.querySelector(".lucide-chevron-down")).toBeInTheDocument();
    expect(document.querySelector(".lucide-chevron-up")).not.toBeInTheDocument();
  });

  it("toggles to expanded state when toggle button is clicked", async () => {
    const user = userEvent.setup();
    renderComponent();

    const button = screen.getByRole("button");
    await user.click(button);

    expect(document.querySelector(".lucide-chevron-up")).toBeInTheDocument();
    expect(document.querySelector(".lucide-chevron-down")).not.toBeInTheDocument();
  });

  it("toggles back to collapsed state on second click", async () => {
    const user = userEvent.setup();
    renderComponent();

    const button = screen.getByRole("button");
    await user.click(button);
    await user.click(button);

    expect(document.querySelector(".lucide-chevron-down")).toBeInTheDocument();
    expect(document.querySelector(".lucide-chevron-up")).not.toBeInTheDocument();
  });

  it("shows collapsed summary when collapsed and collapsedSummary is provided", () => {
    renderComponent({ collapsedSummary: "Summary text here" });
    expect(screen.getByText("Summary text here")).toBeInTheDocument();
  });

  it("does not show collapsed summary when no collapsedSummary prop is provided", () => {
    renderComponent();
    // There should be no summary div rendered
    expect(screen.queryByText("Summary text here")).not.toBeInTheDocument();
  });

  it("hides collapsed summary when expanded", async () => {
    const user = userEvent.setup();
    renderComponent({ collapsedSummary: "Summary goes away" });

    expect(screen.getByText("Summary goes away")).toBeInTheDocument();

    const button = screen.getByRole("button");
    await user.click(button);

    expect(screen.queryByText("Summary goes away")).not.toBeInTheDocument();
  });

  it("shows collapsed summary again after collapsing back", async () => {
    const user = userEvent.setup();
    renderComponent({ collapsedSummary: "Reappearing summary" });

    const button = screen.getByRole("button");
    await user.click(button);
    expect(screen.queryByText("Reappearing summary")).not.toBeInTheDocument();

    await user.click(button);
    expect(screen.getByText("Reappearing summary")).toBeInTheDocument();
  });

  it("applies hidden class to content wrapper when collapsed", () => {
    renderComponent();
    const contentWrapper = document.querySelector('[class*="lg:block"]');
    expect(contentWrapper).toHaveClass("hidden");
  });

  it("applies block class to content wrapper when expanded", async () => {
    const user = userEvent.setup();
    renderComponent();

    const button = screen.getByRole("button");
    await user.click(button);

    const contentWrapper = document.querySelector('[class*="lg:block"]');
    expect(contentWrapper).toHaveClass("block");
    expect(contentWrapper).not.toHaveClass("hidden");
  });

  it("always includes lg:block class on content wrapper", () => {
    renderComponent();
    const contentWrapper = document.querySelector('[class*="lg:block"]');
    expect(contentWrapper).toHaveClass("lg:block");
  });

  it("keeps the toggle beside the title in both states", async () => {
    // One fixed offset, matching the experiment details card: centring on the
    // collapsed card put the chevron below the title row, on a row of its own.
    const user = userEvent.setup();
    renderComponent({ collapsedSummary: "Summary" });

    const toggle = screen.getByRole("button");
    expect(toggle.className).toContain("top-[10px]");
    expect(toggle.className).not.toContain("top-1/2");

    await user.click(toggle);

    expect(screen.getByRole("button").className).toContain("top-[10px]");
    expect(screen.getByRole("button").className).not.toContain("top-1/2");
  });

  it("names the toggle for screen readers", () => {
    renderComponent();
    expect(screen.getByRole("button", { name: "common.expandDetails" })).toBeInTheDocument();
  });

  it("renders complex children", () => {
    renderComponent({
      children: (
        <div>
          <span data-testid="child-1">First child</span>
          <span data-testid="child-2">Second child</span>
        </div>
      ),
    });

    expect(screen.getByTestId("child-1")).toBeInTheDocument();
    expect(screen.getByTestId("child-2")).toBeInTheDocument();
  });

  it("renders toggle button with ghost variant", () => {
    renderComponent();
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });
});
