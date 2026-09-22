import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { InsetPanel } from "../inset-panel";

describe("InsetPanel", () => {
  it("renders its children in a recessed panel", () => {
    const { container } = render(<InsetPanel>Body</InsetPanel>);

    expect(screen.getByText("Body")).toBeInTheDocument();
    // Recessed, not raised: a muted wash and a border, and none of Card's
    // elevation.
    expect(container.firstElementChild).toHaveClass("bg-muted/30", "border", "rounded-md");
    expect(container.firstElementChild).not.toHaveClass("shadow-sm");
    expect(container.firstElementChild).not.toHaveClass("bg-card");
  });

  it("defaults to the medium density and a solid border", () => {
    const { container } = render(<InsetPanel>Body</InsetPanel>);

    expect(container.firstElementChild).toHaveClass("p-3");
    expect(container.firstElementChild).not.toHaveClass("border-dashed");
  });

  it("takes density from a named step rather than a free-form class", () => {
    for (const [padding, expected] of [
      ["sm", "p-2.5"],
      ["md", "p-3"],
      ["lg", "p-4"],
    ] as const) {
      const { container, unmount } = render(<InsetPanel padding={padding}>Body</InsetPanel>);
      expect(container.firstElementChild).toHaveClass(expected);
      unmount();
    }

    const { container } = render(<InsetPanel padding="none">Body</InsetPanel>);
    for (const p of ["p-2.5", "p-3", "p-4"]) {
      expect(container.firstElementChild).not.toHaveClass(p);
    }
  });

  it("marks a placeholder with a dashed border", () => {
    const { container } = render(<InsetPanel dashed>Body</InsetPanel>);
    expect(container.firstElementChild).toHaveClass("border-dashed");
  });

  it("tints the border when the panel is destructive", () => {
    const { container } = render(<InsetPanel tone="destructive">Body</InsetPanel>);
    expect(container.firstElementChild).toHaveClass("border-destructive/30");
  });

  it("leaves the border untinted by default", () => {
    const { container } = render(<InsetPanel>Body</InsetPanel>);
    expect(container.firstElementChild).not.toHaveClass("border-destructive/30");
  });
});
