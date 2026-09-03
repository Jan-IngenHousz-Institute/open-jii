import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { GroupDataByExperimentPanel } from "./group-data-by-experiment-panel";

vi.mock("@repo/ui/components/charts/bar-chart", () => ({
  HorizontalBarChart: vi.fn(() => <div data-testid="experiment-bars" />),
}));

const EXP_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EXP_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BUCKET = "2026-08-13T01:00:00.000Z";

const VISIBLE = [
  { id: EXP_A, name: "Soil Health" },
  { id: EXP_B, name: "Canopy" },
];

describe("GroupDataByExperimentPanel", () => {
  it("sorts experiments by volume and links the ones the viewer can open", () => {
    render(
      <GroupDataByExperimentPanel
        dataByExperiment={[
          { bucketStart: BUCKET, experimentId: EXP_A, count: 2 },
          { bucketStart: BUCKET, experimentId: EXP_B, count: 5 },
          { bucketStart: BUCKET, experimentId: EXP_A, count: 1 },
        ]}
        visibleExperiments={VISIBLE}
        locale="en-US"
      />,
    );

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Canopy");
    expect(rows[1]).toHaveTextContent("Soil Health");
    expect(screen.getByRole("link", { name: /Soil Health/ })).toHaveAttribute(
      "href",
      `/en-US/platform/experiments/${EXP_A}`,
    );
  });

  it("labels unattributed data as unknown, without a link", () => {
    render(
      <GroupDataByExperimentPanel
        dataByExperiment={[{ bucketStart: BUCKET, experimentId: null, count: 4 }]}
        visibleExperiments={VISIBLE}
        locale="en-US"
      />,
    );

    expect(screen.getByText("iot.devices.monitoring.unknownExperiment")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders the empty state without data", () => {
    render(
      <GroupDataByExperimentPanel dataByExperiment={[]} visibleExperiments={[]} locale="en-US" />,
    );

    expect(screen.getByText("iot.devices.monitoring.noExperiments")).toBeInTheDocument();
    expect(screen.queryByTestId("experiment-bars")).not.toBeInTheDocument();
  });
});
