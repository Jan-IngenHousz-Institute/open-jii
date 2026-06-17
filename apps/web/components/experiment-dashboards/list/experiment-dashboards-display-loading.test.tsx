import { render } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ExperimentDashboardsDisplayLoading } from "./experiment-dashboards-display-loading";

describe("ExperimentDashboardsDisplayLoading", () => {
  it("renders a spinner with the spin animation class", () => {
    const { container } = render(<ExperimentDashboardsDisplayLoading />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders a centered fixed-height container", () => {
    const { container } = render(<ExperimentDashboardsDisplayLoading />);
    const root = container.firstElementChild;
    expect(root).toHaveClass("h-32");
    expect(root).toHaveClass("items-center");
    expect(root).toHaveClass("justify-center");
  });
});
