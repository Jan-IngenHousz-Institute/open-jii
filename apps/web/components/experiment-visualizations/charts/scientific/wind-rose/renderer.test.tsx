import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { windRoseDefaultConfig } from "./defaults";
import { WindRoseRenderer } from "./renderer";

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "wind-rose",
    chartFamily: "scientific",
    config: { ...windRoseDefaultConfig() },
    dataConfig: {
      tableName: "device",
      dataSources: [
        { tableName: "device", columnName: "wind_dir", role: "x" },
        { tableName: "device", columnName: "wind_speed", role: "y" },
      ],
    },
    ...overrides,
  });
}

describe("WindRoseRenderer", () => {
  it("shows a config error when the visualization isn't a wind-rose", () => {
    const viz = buildViz({ chartType: "polar" });
    render(<WindRoseRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.invalidConfiguration")).toBeInTheDocument();
  });

  it("falls through to the generic empty-state when X is missing", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "device",
        dataSources: [
          { tableName: "device", columnName: "", role: "x" },
          { tableName: "device", columnName: "wind_speed", role: "y" },
        ],
      },
    });
    render(
      <WindRoseRenderer visualization={viz} experimentId="exp-1" data={[{ wind_speed: 5 }]} />,
    );
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("falls through to the generic empty-state when Y is missing", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "device",
        dataSources: [
          { tableName: "device", columnName: "wind_dir", role: "x" },
          { tableName: "device", columnName: "", role: "y" },
        ],
      },
    });
    render(<WindRoseRenderer visualization={viz} experimentId="exp-1" data={[{ wind_dir: 90 }]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("falls through to the generic empty-state with no rows", () => {
    const viz = buildViz();
    render(<WindRoseRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("renders barpolar traces from binned (direction, speed) rows", () => {
    const viz = buildViz();
    const rows = [
      { wind_dir: 0, wind_speed: 1 },
      { wind_dir: 5, wind_speed: 1.5 },
      { wind_dir: 90, wind_speed: 3 },
      { wind_dir: 92, wind_speed: 4 },
      { wind_dir: 180, wind_speed: 6 },
      { wind_dir: 270, wind_speed: 8 },
    ];
    render(<WindRoseRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("normalises directions outside 0-360 via mod", () => {
    const viz = buildViz();
    const rows = [
      { wind_dir: 380, wind_speed: 1 }, // → 20°
      { wind_dir: -45, wind_speed: 2 }, // → 315°
      { wind_dir: 720, wind_speed: 3 }, // → 0°
    ];
    render(<WindRoseRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("ignores rows whose direction or speed isn't numeric", () => {
    const viz = buildViz();
    const rows = [
      { wind_dir: null, wind_speed: 5 },
      { wind_dir: 90, wind_speed: "n/a" },
      { wind_dir: 180, wind_speed: 3 },
    ];
    render(<WindRoseRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });
});
