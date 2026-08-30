import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { ResourceMetricsCell } from "./resource-metrics-cell";

const activity = {
  kind: "protocol" as const,
  resources: [
    {
      id: "p1",
      measurements: 60,
      days: [
        { date: "2026-08-27", measurements: 20 },
        { date: "2026-08-28", measurements: 40 },
      ],
    },
  ],
  totalMeasurements: 60,
  activeCount: 1,
  windowDays: 30,
  computedAt: null,
};

describe("ResourceMetricsCell", () => {
  it("draws the strip for its own row", async () => {
    server.mount(contract.metrics.getResourceMetrics, { body: activity });

    const { container } = render(<ResourceMetricsCell kind="protocol" resourceId="p1" />);

    expect(await screen.findByRole("img", { name: "resourceMetrics.strip" })).toBeInTheDocument();
    await waitFor(() => {
      expect(container.querySelector("path")).toBeInTheDocument();
    });
  });

  it("stays empty for a row with no recorded activity", async () => {
    server.mount(contract.metrics.getResourceMetrics, { body: activity });

    const { container } = render(<ResourceMetricsCell kind="protocol" resourceId="other" />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});
