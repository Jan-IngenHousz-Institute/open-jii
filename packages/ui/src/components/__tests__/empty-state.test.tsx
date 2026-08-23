import { render, screen } from "@testing-library/react";
import React from "react";

import { Button } from "../button";
import { EmptyState } from "../empty-state";

describe("EmptyState", () => {
  it("renders the description on its own, since it is the only required content", () => {
    render(<EmptyState description="No devices match those filters." />);

    expect(screen.getByText("No devices match those filters.")).toBeDefined();
  });

  it("renders title, icon and action when given them", () => {
    render(
      <EmptyState
        icon={<svg data-testid="glyph" />}
        title="No devices yet"
        description="Register your first device."
        action={<Button>Register device</Button>}
      />,
    );

    expect(screen.getByText("No devices yet")).toBeDefined();
    expect(screen.getByTestId("glyph")).toBeDefined();
    expect(screen.getByRole("button", { name: /register device/i })).toBeDefined();
  });

  it("grows its well and body with size", () => {
    const { container, rerender } = render(
      <EmptyState size="page" icon={<svg />} description="Nothing here." />,
    );
    expect(container.firstChild).toHaveClass("py-12");
    expect(container.querySelector(".size-24")).not.toBeNull();

    rerender(<EmptyState size="panel" icon={<svg />} description="Nothing here." />);
    expect(container.querySelector(".size-10")).not.toBeNull();
  });

  it("hides the well at inline size, where there is no room for it", () => {
    const { container } = render(
      <EmptyState size="inline" icon={<svg />} description="All experiments are onboarded." />,
    );

    expect(container.querySelector(".hidden")).not.toBeNull();
  });

  it("tints the body destructive only for the error variant", () => {
    const { rerender } = render(<EmptyState variant="error" description="Could not load." />);
    expect(screen.getByText("Could not load.")).toHaveClass("text-destructive");

    rerender(<EmptyState variant="planned" description="Calibration will appear here." />);
    expect(screen.getByText("Calibration will appear here.")).toHaveClass("text-muted-foreground");
  });

  it("keeps the error variant's border solid so it reads as a fault, not an absence", () => {
    const { container } = render(<EmptyState variant="error" description="Could not load." />);

    expect(container.firstChild).toHaveClass("border-solid");
  });
});
