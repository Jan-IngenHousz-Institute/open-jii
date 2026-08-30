import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { ResourceActivityCell } from "./resource-activity-cell";

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

describe("ResourceActivityCell", () => {
  it("draws the strip for its own row", async () => {
    server.mount(contract.metrics.getResourceActivity, { body: activity });

    const { container } = render(
      <ResourceActivityCell kind="protocol" resourceId="p1" pageIds={["p1"]} />,
    );

    expect(await screen.findByRole("img", { name: "resourceActivity.strip" })).toBeInTheDocument();
    await waitFor(() => {
      expect(container.querySelectorAll("rect")).toHaveLength(2);
    });
  });

  it("stays empty for a row with no recorded activity", async () => {
    server.mount(contract.metrics.getResourceActivity, { body: activity });

    const { container } = render(
      <ResourceActivityCell kind="protocol" resourceId="other" pageIds={["other"]} />,
    );

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});
