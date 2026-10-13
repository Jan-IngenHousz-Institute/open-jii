import { render, screen } from "@/test/test-utils";
import { cookies } from "next/headers";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAnonymousServerOrpcClient } from "~/lib/server-orpc";

import { PublicMetricsPanel } from "./public-metrics-panel";

const getPublicMetrics = vi.hoisted(() => vi.fn());

vi.mock("~/lib/server-orpc", () => ({
  createAnonymousServerOrpcClient: vi.fn(() => ({ metrics: { getPublicMetrics } })),
}));

vi.mock("./public-metrics-section", () => ({
  PublicMetricsSection: () => <section aria-label="metrics">metrics</section>,
}));

describe("PublicMetricsPanel", () => {
  beforeEach(() => {
    getPublicMetrics.mockReset();
  });

  it("reads the public figures without the visitor's session", async () => {
    getPublicMetrics.mockResolvedValue({});

    const panel = await PublicMetricsPanel({ locale: "en-US" });
    if (!panel) {
      throw new Error("the panel rendered nothing");
    }
    render(panel);

    expect(screen.getByRole("region", { name: "metrics" })).toBeInTheDocument();
    expect(createAnonymousServerOrpcClient).toHaveBeenCalled();
    expect(cookies).not.toHaveBeenCalled();
  });

  it("drops the section when the figures cannot be read", async () => {
    getPublicMetrics.mockRejectedValue(new Error("warehouse down"));

    const panel = await PublicMetricsPanel({ locale: "en-US" });

    expect(panel).toBeNull();
  });
});
