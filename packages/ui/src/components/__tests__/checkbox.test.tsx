import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { Checkbox } from "../checkbox";

describe("Checkbox", () => {
  it("keeps one check mark mounted and shows it from the checkbox's own state", () => {
    render(<Checkbox aria-label="Select row" />);
    const checkbox = screen.getByRole("checkbox", { name: "Select row" });
    const mark = checkbox.querySelector("svg");

    expect(checkbox.getAttribute("data-state")).toBe("unchecked");
    expect(mark?.getAttribute("class")).toContain("hidden");
    expect(mark?.getAttribute("class")).toContain("group-data-[state=checked]/checkbox:block");

    fireEvent.click(checkbox);

    expect(checkbox.getAttribute("data-state")).toBe("checked");
    expect(checkbox.querySelector("svg")).toBe(mark);
  });
});
