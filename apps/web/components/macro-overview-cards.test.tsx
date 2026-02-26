import { createMacro } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { MacroOverviewCards } from "./macro-overview-cards";

describe("MacroOverviewCards", () => {
  it("shows loading skeletons when loading", () => {
    const { container } = render(<MacroOverviewCards macros={undefined} isLoading={true} />);
    // Skeleton renders as animated divs
    expect(container.querySelectorAll("[class*=animate]").length).toBeGreaterThan(0);
  });

  it("shows empty message when no macros", () => {
    render(<MacroOverviewCards macros={[]} isLoading={false} />);
    expect(screen.getByText("macros.noMacros")).toBeInTheDocument();
  });

  it("renders macro cards with name and language", () => {
    render(
      <MacroOverviewCards
        macros={[createMacro({ name: "Test Macro", language: "python" })]}
        isLoading={false}
      />,
    );

    expect(screen.getByText("Test Macro")).toBeInTheDocument();
    expect(screen.getByText("Python")).toBeInTheDocument();
  });

  it("shows preferred badge for sorted macros", () => {
    render(<MacroOverviewCards macros={[createMacro({ sortOrder: 1 })]} isLoading={false} />);
    expect(screen.getByText("common.preferred")).toBeInTheDocument();
  });

  it("links to macro detail page", () => {
    render(<MacroOverviewCards macros={[createMacro({ id: "m-1" })]} isLoading={false} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/platform/macros/m-1");
  });
});
