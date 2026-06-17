import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { MetaField } from "./meta-field";

describe("MetaField", () => {
  it("renders the label and value text", () => {
    render(<MetaField label="Created" value="Jan 1, 2025" />);
    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("Jan 1, 2025")).toBeInTheDocument();
  });

  it("renders both as separate elements (label and value are siblings)", () => {
    render(<MetaField label="Updated" value="-" />);
    const label = screen.getByText("Updated");
    const value = screen.getByText("-");
    expect(label).not.toBe(value);
    expect(label.parentElement).toBe(value.parentElement);
  });

  it("treats empty value as still renderable", () => {
    render(<MetaField label="Owner" value="" />);
    expect(screen.getByText("Owner")).toBeInTheDocument();
  });
});
