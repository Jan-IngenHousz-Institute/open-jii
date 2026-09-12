import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Card, CardContent, CardFooter, CardHeader } from "../card";

describe("Card", () => {
  it("renders a raised surface with the default rhythm", () => {
    const { container } = render(<Card>Body</Card>);

    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("bg-card", "border", "rounded-xl", "shadow-sm");
    expect(container.firstElementChild).toHaveClass("py-6", "gap-6");
  });

  it("takes density from a named step rather than a free-form class", () => {
    for (const [padding, expected] of [
      ["none", ["py-0", "gap-0"]],
      ["sm", ["py-3", "gap-2"]],
      ["md", ["py-6", "gap-6"]],
    ] as const) {
      const { container, unmount } = render(<Card padding={padding}>Body</Card>);
      expect(container.firstElementChild).toHaveClass(...expected);
      unmount();
    }
  });

  it("lets a full-bleed child reach the card edge", () => {
    // What a divide-y list, a table or a footer bar needs: the card's own py-6
    // leaves a 24px band under them, and gap-6 floats their divider away.
    const { container } = render(<Card padding="none">Body</Card>);

    expect(container.firstElementChild).not.toHaveClass("py-6");
    expect(container.firstElementChild).not.toHaveClass("gap-6");
  });

  it("keeps the horizontal inset on the children, not the card", () => {
    // Vertical rhythm belongs to Card, horizontal to the slots. A slot that
    // also sets py-* adds to the card's, which tailwind-merge cannot see.
    const { container } = render(
      <Card>
        <CardHeader>Head</CardHeader>
        <CardContent>Content</CardContent>
        <CardFooter>Foot</CardFooter>
      </Card>,
    );

    expect(container.firstElementChild).not.toHaveClass("px-6");
    for (const text of ["Head", "Content", "Foot"]) {
      expect(screen.getByText(text)).toHaveClass("px-6");
    }
  });

  it("lifts on hover only when interactive", () => {
    const { container, unmount } = render(<Card interactive>Body</Card>);
    expect(container.firstElementChild).toHaveClass("hover:shadow-lg");
    unmount();

    const { container: plain } = render(<Card>Body</Card>);
    expect(plain.firstElementChild).not.toHaveClass("hover:shadow-lg");
  });

  it("lets a consumer class win over the named step", () => {
    const { container } = render(<Card className="py-10">Body</Card>);

    expect(container.firstElementChild).toHaveClass("py-10");
    expect(container.firstElementChild).not.toHaveClass("py-6");
  });
});
