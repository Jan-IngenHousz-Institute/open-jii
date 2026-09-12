import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { WorkspaceBand, workspaceBleed } from "../workspace-band";

describe("workspaceBleed", () => {
  it("cancels the platform shell's padding at every breakpoint it sets", () => {
    // Matches the shell's padding at every tier, or the band gutters/overflows.
    for (const cls of [
      "-mx-4",
      "-mb-4",
      "px-4",
      "pb-4",
      "md:-mx-6",
      "md:-mb-6",
      "md:px-6",
      "md:pb-6",
      "3xl:-mx-10",
      "3xl:px-10",
      "4xl:-mx-14",
      "4xl:px-14",
    ]) {
      expect(workspaceBleed.split(" ")).toContain(cls);
    }
  });
});

describe("WorkspaceBand", () => {
  it("renders the tinted surface with the shared bleed", () => {
    const { container } = render(<WorkspaceBand>Body</WorkspaceBand>);

    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("bg-canvas", "border-t");
    expect(container.firstElementChild).toHaveClass("-mx-4", "md:-mx-6");
  });

  it("starts below the shell's top padding by default", () => {
    // In the base string this would pull every band up under its own heading.
    const { container } = render(<WorkspaceBand>Body</WorkspaceBand>);

    expect(container.firstElementChild).not.toHaveClass("-mt-4");
    expect(container.firstElementChild).not.toHaveClass("md:-mt-6");
  });

  it("reaches the shell header when it is the whole page", () => {
    const { container } = render(<WorkspaceBand flush>Body</WorkspaceBand>);

    expect(container.firstElementChild).toHaveClass("-mt-4", "md:-mt-6");
  });
});
