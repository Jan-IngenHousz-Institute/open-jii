import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import ExperimentVisualizationsHighlights from "./experiment-visualizations-highlights";

describe("ExperimentVisualizationsHighlights", () => {
  it("previews the three most recently updated charts, newest first", () => {
    const older = createVisualization({ name: "Older", updatedAt: "2026-01-01T00:00:00.000Z" });
    const newer = createVisualization({ name: "Newer", updatedAt: "2026-06-01T00:00:00.000Z" });

    render(
      <ExperimentVisualizationsHighlights
        visualizations={[older, newer]}
        experimentId="exp-1"
        isLoading={false}
      />,
    );

    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAccessibleName("Newer");
    expect(links[1]).toHaveAccessibleName("Older");
  });

  it("caps the grid, so a long list does not become a wall of charts", () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      createVisualization({ name: `Chart ${i}`, id: `viz-${i}` }),
    );

    render(
      <ExperimentVisualizationsHighlights
        visualizations={many}
        experimentId="exp-1"
        isLoading={false}
      />,
    );

    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("renders nothing when the experiment has no visualizations", () => {
    const { container } = render(
      <ExperimentVisualizationsHighlights
        visualizations={[]}
        experimentId="exp-1"
        isLoading={false}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("points an archived experiment at its archive route", () => {
    const viz = createVisualization({ name: "Chart", id: "viz-1" });

    render(
      <ExperimentVisualizationsHighlights
        visualizations={[viz]}
        experimentId="exp-1"
        isLoading={false}
        isArchived
      />,
    );

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/platform/experiments-archive/exp-1/analysis/visualizations/viz-1",
    );
  });
});
