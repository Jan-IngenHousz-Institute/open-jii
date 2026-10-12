import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScrollArea } from "../scroll-area";

describe("ScrollArea", () => {
  it("lets a max-height on the root bound the viewport so it scrolls", () => {
    render(
      <ScrollArea data-testid="root" className="max-h-[280px]">
        <p>Upload #1</p>
      </ScrollArea>,
    );

    const root = screen.getByTestId("root");
    const viewport = root.querySelector("[data-radix-scroll-area-viewport]");

    expect(root).toHaveClass("flex", "flex-col", "max-h-[280px]");
    expect(viewport).toHaveClass("size-full", "min-h-0");
    expect(viewport).toHaveTextContent("Upload #1");
  });
});
