import { render, screen } from "@/test/test-utils";
import { FlaskConical } from "lucide-react";
import { describe, expect, it } from "vitest";

import { FirstWorkCard } from "./first-work-card";

function renderCard() {
  return render(
    <FirstWorkCard
      href="/en-US/platform/experiments/new"
      icon={FlaskConical}
      title="Create an experiment"
      description="Set up your own experiment and start measuring."
    />,
  );
}

describe("FirstWorkCard", () => {
  it("makes the whole card one link", () => {
    renderCard();

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/en-US/platform/experiments/new");
    expect(link).toHaveTextContent("Create an experiment");
    expect(link).toHaveTextContent("Set up your own experiment and start measuring.");
  });

  it("renders the title as a heading", () => {
    renderCard();

    expect(screen.getByRole("heading", { name: "Create an experiment" })).toBeInTheDocument();
  });

  it("hides the icon from assistive technology", () => {
    const { container } = renderCard();

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
