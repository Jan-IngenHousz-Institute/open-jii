import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { StyleSubsection } from "./style-subsection";

describe("StyleSubsection", () => {
  it("renders the title as a heading and the children", () => {
    render(
      <StyleSubsection title="Marker options">
        <span>inner content</span>
      </StyleSubsection>,
    );
    expect(screen.getByRole("heading", { name: "Marker options" })).toBeInTheDocument();
    expect(screen.getByText("inner content")).toBeInTheDocument();
  });

  it("uses an aria-level=3 heading so it nests inside the parent section", () => {
    render(
      <StyleSubsection title="Bar appearance">
        <span>x</span>
      </StyleSubsection>,
    );
    expect(screen.getByRole("heading", { name: "Bar appearance" })).toHaveAttribute(
      "aria-level",
      "3",
    );
  });

  it("renders multiple children inside the subsection", () => {
    render(
      <StyleSubsection title="Block">
        <span>first</span>
        <span>second</span>
      </StyleSubsection>,
    );
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.getByText("second")).toBeInTheDocument();
  });
});
