import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ResourceCard } from "./resource-card";

/** Mirrors `VisibilityBadge privateOnly`: an element that renders nothing when public. */
function ConditionalBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return <span data-testid="badge">Private</span>;
}

function renderCard(badges?: React.ReactNode) {
  return render(
    <ResourceCard href="/x" title="Canopy Light Interception" badges={badges}>
      <p>A description</p>
    </ResourceCard>,
  );
}

describe("ResourceCard", () => {
  it("renders the title and description", () => {
    renderCard();
    expect(screen.getByRole("heading", { name: "Canopy Light Interception" })).toBeInTheDocument();
    expect(screen.getByText("A description")).toBeInTheDocument();
  });

  it("omits the badge row entirely when no badges prop is passed", () => {
    const { container } = renderCard();
    expect(container.querySelector(".inline-flex")).toBeNull();
  });

  // `badges` is a JSX element even when it renders null, so the row was always
  // present but collapsed to 0px for public resources, dropping those titles
  // 22px above their neighbours in the grid.
  it("reserves the badge row height when the badge itself renders nothing", () => {
    const { container } = renderCard(<ConditionalBadge show={false} />);

    const row = container.querySelector(".inline-flex");
    expect(screen.queryByTestId("badge")).toBeNull();
    expect(row).not.toBeNull();
    expect(row).toHaveClass("min-h-[1.375rem]");
  });

  it("uses the same reserved row when a badge does render", () => {
    const { container } = renderCard(<ConditionalBadge show />);

    expect(screen.getByTestId("badge")).toBeInTheDocument();
    expect(container.querySelector(".inline-flex")).toHaveClass("min-h-[1.375rem]");
  });
});
