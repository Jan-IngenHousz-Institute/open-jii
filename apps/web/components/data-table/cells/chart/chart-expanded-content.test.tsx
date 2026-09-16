import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { ChartExpandedContent } from "./chart-expanded-content";

vi.mock("@repo/ui/components/charts/line-chart", () => ({
  LineChart: vi.fn(() => <div data-testid="line-chart" />),
}));

const mockColumnName = "test_column";

describe("ChartExpandedContent", () => {
  it("renders a chart for valid array data", () => {
    render(<ChartExpandedContent data="[1,2,3,4,5]" columnName={mockColumnName} />);
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
  });

  it("returns null for empty data", () => {
    const { container } = render(<ChartExpandedContent data="[]" columnName={mockColumnName} />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null for unparseable data", () => {
    const { container } = render(
      <ChartExpandedContent data="not-parseable" columnName={mockColumnName} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
