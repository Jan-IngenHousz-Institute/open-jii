import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { VisualizationMetaField } from "./visualization-meta-field";

describe("VisualizationMetaField", () => {
  it("renders the label and the value as text", () => {
    render(<VisualizationMetaField label="Created at" value="Jan 1, 2025" />);
    expect(screen.getByText("Created at")).toBeInTheDocument();
    expect(screen.getByText("Jan 1, 2025")).toBeInTheDocument();
  });

  it("does not apply the mono font class by default", () => {
    render(<VisualizationMetaField label="Owner" value="Jane" />);
    expect(screen.getByText("Jane")).not.toHaveClass("font-mono");
  });

  it("applies the mono font class when mono=true", () => {
    render(<VisualizationMetaField label="Table" value="raw_data" mono />);
    expect(screen.getByText("raw_data")).toHaveClass("font-mono");
  });

  it("renders an empty string value without crashing", () => {
    render(<VisualizationMetaField label="Description" value="" />);
    expect(screen.getByText("Description")).toBeInTheDocument();
  });
});
