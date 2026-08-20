import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { Tile } from "./tile";

describe("Tile", () => {
  it("renders the label with its content", () => {
    render(
      <Tile label="Online">
        <span>3 of 4</span>
      </Tile>,
    );

    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(screen.getByText("3 of 4")).toBeInTheDocument();
  });
});
