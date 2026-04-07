import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { DetailsSidebarCard } from "../details-sidebar-card";

// ---------- Mocks ----------
vi.mock("lucide-react", () => ({
  ChevronDown: () => <span data-testid="icon-chevron-down">ChevronDown</span>,
  ChevronUp: () => <span data-testid="icon-chevron-up">ChevronUp</span>,
}));

vi.mock("@repo/ui/components", () => ({
  Button: ({
    children,
    onClick,
    className,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    variant?: string;
  }) => (
    <button onClick={onClick} className={className} data-variant={variant}>
      {children}
    </button>
  ),
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-header">{children}</div>
  ),
}));

// ---------- Helpers ----------
function renderComponent(props: Partial<React.ComponentProps<typeof DetailsSidebarCard>> = {}) {
  const defaultProps: React.ComponentProps<typeof DetailsSidebarCard> = {
    title: "Test Title",
    children: <p>Test children content</p>,
    ...props,
  };

  return render(<DetailsSidebarCard {...defaultProps} />);
}

// ---------- Tests ----------
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
    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.getByTestId("card-header")).toBeInTheDocument();
    expect(screen.getByTestId("card-content")).toBeInTheDocument();
  });

  it("renders the title inside an h3 element", () => {
    renderComponent({ title: "Heading Title" });
    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading).toHaveTextContent("Heading Title");
  });

  // ---------- Collapse / Expand behavior ----------
  it("starts in collapsed state by default", () => {
    renderComponent();
    expect(screen.getByTestId("icon-chevron-down")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-chevron-up")).not.toBeInTheDocument();
  });

  it("toggles to expanded state when toggle button is clicked", async () => {
    const user = userEvent.setup();
    renderComponent();

    const button = screen.getByRole("button");
    await user.click(button);

    expect(screen.getByTestId("icon-chevron-up")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-chevron-down")).not.toBeInTheDocument();
  });

  it("toggles back to collapsed state on second click", async () => {
    const user = userEvent.setup();
    renderComponent();

    const button = screen.getByRole("button");
    await user.click(button);
    await user.click(button);

    expect(screen.getByTestId("icon-chevron-down")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-chevron-up")).not.toBeInTheDocument();
  });

  // ---------- Collapsed summary ----------
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

  // ---------- CSS class behavior ----------
  it("applies hidden class to content wrapper when collapsed", () => {
    renderComponent();
    const contentWrapper = screen.getByTestId("card-content").parentElement;
    expect(contentWrapper).toHaveClass("hidden");
  });

  it("applies block class to content wrapper when expanded", async () => {
    const user = userEvent.setup();
    renderComponent();

    const button = screen.getByRole("button");
    await user.click(button);

    const contentWrapper = screen.getByTestId("card-content").parentElement;
    expect(contentWrapper).toHaveClass("block");
    expect(contentWrapper).not.toHaveClass("hidden");
  });

  it("always includes md:block class on content wrapper", () => {
    renderComponent();
    const contentWrapper = screen.getByTestId("card-content").parentElement;
    expect(contentWrapper).toHaveClass("md:block");
  });

  // ---------- Button positioning ----------
  it("applies correct positioning class to toggle button when collapsed", () => {
    renderComponent();
    const button = screen.getByRole("button");
    expect(button.className).toContain("top-1/2");
    expect(button.className).toContain("-translate-y-1/2");
  });

  it("applies correct positioning class to toggle button when expanded", async () => {
    const user = userEvent.setup();
    renderComponent();

    const button = screen.getByRole("button");
    await user.click(button);

    expect(button.className).toContain("top-4");
    expect(button.className).toContain("translate-y-0");
  });

  // ---------- Children rendering ----------
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

  // ---------- Toggle button uses ghost variant ----------
  it("renders toggle button with ghost variant", () => {
    renderComponent();
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-variant", "ghost");
  });
});
