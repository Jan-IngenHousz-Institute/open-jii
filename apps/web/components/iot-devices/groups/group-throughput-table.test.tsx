import { render, screen } from "@/test/test-utils";
import { formatTimestamp } from "@/util/date";
import { describe, expect, it } from "vitest";

import { GroupThroughputTable } from "./group-throughput-table";

const BUCKET_ONE = "2026-08-13T00:00:00.000Z";
const BUCKET_TWO = "2026-08-13T01:00:00.000Z";

describe("GroupThroughputTable", () => {
  it("renders one row per non-empty bucket and series pair", () => {
    render(
      <GroupThroughputTable
        series={[
          { key: "a", name: "Alpha", counts: [2, 0] },
          { key: "b", name: "Beta", counts: [0, 3] },
        ]}
        axis={[BUCKET_ONE, BUCKET_TWO]}
        locale="en-US"
      />,
    );

    // Header plus the two pairs that actually have data.
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(formatTimestamp(BUCKET_ONE, "en-US"))).toBeInTheDocument();
    expect(screen.getByText(formatTimestamp(BUCKET_TWO, "en-US"))).toBeInTheDocument();
  });

  it("omits a series that never produced data", () => {
    render(
      <GroupThroughputTable
        series={[
          { key: "a", name: "Alpha", counts: [1, 1] },
          { key: "c", name: "Gamma", counts: [0, 0] },
        ]}
        axis={[BUCKET_ONE, BUCKET_TWO]}
        locale="en-US"
      />,
    );

    expect(screen.queryByText("Gamma")).not.toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });
});
