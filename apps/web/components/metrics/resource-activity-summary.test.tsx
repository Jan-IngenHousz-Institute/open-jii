import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { ResourceActivitySummary } from "./resource-activity-summary";

const activity = {
  kind: "protocol" as const,
  resources: [
    {
      id: "p1",
      measurements: 4_200,
      days: [
        { date: "2026-08-27", measurements: 2_000 },
        { date: "2026-08-28", measurements: 2_200 },
      ],
    },
  ],
  totalMeasurements: 4_200,
  activeCount: 1,
  windowDays: 30,
  computedAt: null,
};

describe("ResourceActivitySummary", () => {
  it("states what the reader's own resources recorded", async () => {
    server.mount(contract.metrics.getResourceActivity, { body: activity });

    render(<ResourceActivitySummary kind="protocol" />);

    expect(await screen.findByText("4.2K")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("resourceActivity.protocol.active")).toBeInTheDocument();
  });

  it("renders nothing when no resource has recorded anything", async () => {
    server.mount(contract.metrics.getResourceActivity, {
      body: { ...activity, resources: [], totalMeasurements: 0, activeCount: 0 },
    });

    const { container } = render(<ResourceActivitySummary kind="protocol" />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});
