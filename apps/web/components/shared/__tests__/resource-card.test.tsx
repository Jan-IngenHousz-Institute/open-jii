import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ResourceCard, ResourceCardGrid } from "../resource-card";

describe("ResourceCard", () => {
  it("links the whole tile and renders every slot", () => {
    render(
      <ResourceCard
        href="/platform/macros/m1"
        title="Photosynthesis"
        badges={<span>Python</span>}
        extra={<span>compat</span>}
        footer="Updated today"
      >
        <span>A description</span>
      </ResourceCard>,
    );

    expect(screen.getByRole("link")).toHaveAttribute("href", "/platform/macros/m1");
    expect(screen.getByRole("heading", { name: "Photosynthesis" })).toBeInTheDocument();
    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getByText("compat")).toBeInTheDocument();
    expect(screen.getByText("Updated today")).toBeInTheDocument();
    expect(screen.getByText("A description")).toBeInTheDocument();
  });

  it("takes its surface from Card and lays the featured gradient over it", () => {
    const { container: plain } = render(<ResourceCard href="/a" title="Plain" />);
    const plainTile = plain.querySelector("a > div");
    // Chrome comes from Card, not from the tile's own variant.
    expect(plainTile).toHaveClass("bg-card", "border", "rounded-xl");
    expect(plainTile).not.toHaveClass("bg-gradient-to-br");

    const { container: featured } = render(<ResourceCard href="/b" title="Featured" featured />);
    const tile = featured.querySelector("a > div");
    // Still Card's chrome, minus the flat fill: `cn` merges `bg-card` away in
    // favour of the gradient, whose `to-card` stop lands on the same colour.
    expect(tile).toHaveClass("border", "rounded-xl");
    expect(tile).toHaveClass("from-status-featured", "to-card", "bg-gradient-to-br");
    expect(tile).toHaveClass("border-secondary/30");
    expect(tile).not.toHaveClass("bg-card");
  });
});

describe("ResourceCardGrid", () => {
  it("marks the grid busy while loading", () => {
    const { container } = render(
      <ResourceCardGrid isLoading>
        <span>a card</span>
      </ResourceCardGrid>,
    );
    expect(container.firstElementChild).toHaveAttribute("aria-busy", "true");
  });

  it("renders three skeletons while loading, and no children", () => {
    const { container } = render(
      <ResourceCardGrid isLoading>
        <span>a card</span>
      </ResourceCardGrid>,
    );

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);
    expect(screen.queryByText("a card")).not.toBeInTheDocument();
  });

  it("renders the empty message and its extra instead of children", () => {
    render(
      <ResourceCardGrid isEmpty emptyMessage="No macros yet" emptyExtra={<span>Get started</span>}>
        <span>a card</span>
      </ResourceCardGrid>,
    );

    expect(screen.getByText("No macros yet")).toBeInTheDocument();
    expect(screen.getByText("Get started")).toBeInTheDocument();
    expect(screen.queryByText("a card")).not.toBeInTheDocument();
  });

  it("renders children in the three-across grid otherwise", () => {
    const { container } = render(
      <ResourceCardGrid>
        <span>a card</span>
      </ResourceCardGrid>,
    );

    expect(screen.getByText("a card")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("md:grid-cols-2", "lg:grid-cols-3");
  });
});
