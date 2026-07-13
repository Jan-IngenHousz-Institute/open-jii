import { createCommand } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { CommandOverviewCards } from "./command-overview-cards";

describe("CommandOverviewCards", () => {
  it("shows loading skeletons when undefined", () => {
    render(<CommandOverviewCards commands={undefined} />);
    expect(document.querySelectorAll("[class*=animate]").length).toBeGreaterThan(0);
  });

  it("shows empty message when no commands", () => {
    render(<CommandOverviewCards commands={[]} />);
    expect(screen.getByText("commands.noCommands")).toBeInTheDocument();
  });

  it("renders command cards with name and family", () => {
    render(
      <CommandOverviewCards
        commands={[createCommand({ name: "Test Command", family: "multispeq" })]}
      />,
    );

    expect(screen.getByText("Test Command")).toBeInTheDocument();
    expect(screen.getByText("multispeq")).toBeInTheDocument();
  });

  it("uses the active badge color for the ambyte family", () => {
    render(
      <CommandOverviewCards
        commands={[createCommand({ name: "Ambyte Command", family: "ambyte" })]}
      />,
    );

    expect(screen.getByText("ambyte")).toHaveClass("bg-badge-active");
  });

  it("shows preferred badge for sorted commands", () => {
    render(<CommandOverviewCards commands={[createCommand({ sortOrder: 1 })]} />);
    expect(screen.getByText("common.preferred")).toBeInTheDocument();
  });

  it("links to command detail page", () => {
    render(<CommandOverviewCards commands={[createCommand({ id: "p-1" })]} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/en-US/platform/commands/p-1");
  });
});
