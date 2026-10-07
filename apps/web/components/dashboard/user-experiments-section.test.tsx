import { createExperiment } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { UserExperimentsSection } from "./user-experiments-section";

vi.mock("~/components/dashboard/first-work-cards", () => ({
  FirstWorkCards: () => <div data-testid="first-work-cards" />,
}));

vi.mock("~/components/experiment-overview-cards", () => ({
  ExperimentOverviewCards: (props: { experiments?: unknown[] }) => (
    <div data-testid="experiment-cards">{props.experiments?.length ?? 0} experiments</div>
  ),
}));

const envelope = (items: unknown[]) => ({
  items,
  page: 1,
  pageSize: 3,
  totalPages: 1,
  totalCount: items.length,
});

describe("UserExperimentsSection", () => {
  it("shows skeletons while loading then resolves", () => {
    server.mount(contract.experiments.listExperiments, { body: envelope([]), delay: 100 });
    render(<UserExperimentsSection />);

    // Initially shows skeletons (no experiment-cards yet)
    expect(screen.queryByTestId("experiment-cards")).not.toBeInTheDocument();
  });

  it("renders the page the server returned, without slicing it again", async () => {
    server.mount(contract.experiments.listExperiments, {
      body: envelope([
        createExperiment({ id: "1" }),
        createExperiment({ id: "2" }),
        createExperiment({ id: "3" }),
      ]),
    });

    render(<UserExperimentsSection />);

    await waitFor(() => {
      expect(screen.getByTestId("experiment-cards")).toHaveTextContent("3 experiments");
    });
  });

  it("offers the first-work cards when the researcher has no experiments", async () => {
    server.mount(contract.experiments.listExperiments, { body: envelope([]) });

    render(<UserExperimentsSection />);

    expect(await screen.findByTestId("first-work-cards")).toBeInTheDocument();
    expect(screen.queryByTestId("experiment-cards")).not.toBeInTheDocument();
  });

  it("keeps the first-work cards away from a researcher with experiments", async () => {
    server.mount(contract.experiments.listExperiments, {
      body: envelope([createExperiment({ id: "1" })]),
    });

    render(<UserExperimentsSection />);

    expect(await screen.findByTestId("experiment-cards")).toBeInTheDocument();
    expect(screen.queryByTestId("first-work-cards")).not.toBeInTheDocument();
  });

  it("does not offer the first-work cards when the list fails to load", async () => {
    const spy = server.mount(contract.experiments.listExperiments, { status: 500 });

    render(<UserExperimentsSection />);

    await waitFor(() => expect(spy.called).toBe(true));
    expect(screen.queryByTestId("first-work-cards")).not.toBeInTheDocument();
  });
});
