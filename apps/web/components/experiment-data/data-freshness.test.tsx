import { createExperimentTable } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { DataFreshness } from "./data-freshness";

describe("DataFreshness", () => {
  it("says the page is live and when the newest row arrived", async () => {
    server.mount(contract.experiments.getExperimentTables, {
      body: [createExperimentTable({ latestRowAt: "2026-09-22T10:05:00.000Z" })],
    });

    render(<DataFreshness experimentId="exp-1" />);

    expect(await screen.findByText("experimentData.freshness.live")).toBeInTheDocument();
    expect(screen.getByText("experimentData.freshness.newestData")).toBeInTheDocument();
  });

  it("says there are no rows yet for an empty experiment", async () => {
    server.mount(contract.experiments.getExperimentTables, { body: [] });

    render(<DataFreshness experimentId="exp-1" />);

    expect(await screen.findByText("experimentData.freshness.noRows")).toBeInTheDocument();
  });

  it("pauses and resumes live updates", async () => {
    server.mount(contract.experiments.getExperimentTables, {
      body: [createExperimentTable({ latestRowAt: "2026-09-22T10:05:00.000Z" })],
    });
    const user = userEvent.setup();

    render(<DataFreshness experimentId="exp-1" />);
    await user.click(await screen.findByRole("button", { name: "experimentData.freshness.pause" }));

    expect(screen.getByText("experimentData.freshness.paused")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "experimentData.freshness.resume" }));

    expect(screen.getByText("experimentData.freshness.live")).toBeInTheDocument();
  });

  it("renders nothing until the listing arrives", () => {
    server.mount(contract.experiments.getExperimentTables, { delay: "infinite" });

    const { container } = render(<DataFreshness experimentId="exp-1" />);

    expect(container).toBeEmptyDOMElement();
  });
});
