import { createExperiment } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { ExperimentStandardsReadiness } from "./experiment-standards-readiness";

const experiment = createExperiment();

const followingTwo = {
  followed: ["miappe", "crop-ontology"],
  standards: [],
  steps: [
    { reason: { code: "no-location" }, holdsFreeze: true, standards: ["miappe"] },
    {
      reason: { code: "plots-left-skipped", subjects: ["A4"] },
      holdsFreeze: false,
      standards: [],
    },
  ],
};

describe("<ExperimentStandardsReadiness />", () => {
  it("names what the experiment follows and links to its steps while one holds Freeze", async () => {
    server.mount(contract.experiments.getExperimentStandards, { body: followingTwo });
    render(<ExperimentStandardsReadiness experiment={experiment} />);

    const link = await screen.findByRole("link", { name: "line.seeSteps" });
    expect(link).toHaveAttribute("href", `/en-US/platform/experiments/${experiment.id}/datasets`);
    expect(screen.getByText(/line\.follows/)).toBeInTheDocument();
    expect(screen.getByText(/line\.steps/)).toBeInTheDocument();
  });

  it("says nothing holds Freeze when no step does", async () => {
    server.mount(contract.experiments.getExperimentStandards, {
      body: { followed: [], standards: [], steps: [] },
    });
    render(<ExperimentStandardsReadiness experiment={experiment} />);

    expect(await screen.findByRole("link", { name: "line.openDatasets" })).toBeInTheDocument();
    expect(screen.getByText(/line\.followsOnly/)).toBeInTheDocument();
    expect(screen.getByText(/line\.ready/)).toBeInTheDocument();
  });

  it("leaves the line out when the standards cannot be loaded", async () => {
    const spy = server.mount(contract.experiments.getExperimentStandards, { status: 500 });
    render(<ExperimentStandardsReadiness experiment={experiment} />);

    await waitFor(() => expect(spy.called).toBe(true));
    expect(screen.queryByTestId("standards-line")).toBeNull();
  });
});
