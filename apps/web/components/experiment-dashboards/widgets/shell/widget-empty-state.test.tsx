import { render, screen } from "@/test/test-utils";
import { BarChart3 } from "lucide-react";
import { describe, expect, it } from "vitest";

import { WidgetEmptyState } from "./widget-empty-state";

describe("WidgetEmptyState", () => {
  it("renders the title text", () => {
    render(<WidgetEmptyState icon={BarChart3} title="Pick a chart" />);
    expect(screen.getByText("Pick a chart")).toBeInTheDocument();
  });

  it("renders the description below the title when provided", () => {
    render(
      <WidgetEmptyState
        icon={BarChart3}
        title="Pick a chart"
        description="Choose a visualization from the picker"
      />,
    );
    expect(screen.getByText("Choose a visualization from the picker")).toBeInTheDocument();
  });

  it("omits the description paragraph when not provided", () => {
    render(<WidgetEmptyState icon={BarChart3} title="Pick a chart" />);
    expect(screen.queryByText(/Choose/)).not.toBeInTheDocument();
  });
});
