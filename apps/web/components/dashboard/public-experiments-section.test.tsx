import { createExperiment } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { PublicExperimentsSection } from "./public-experiments-section";

vi.mock("~/components/experiment-overview-cards", () => ({
  ExperimentOverviewCards: (props: { experiments?: unknown[]; showUpdatedLabel?: boolean }) => (
    <div data-testid="experiment-cards" data-updated-label={String(props.showUpdatedLabel)}>
      {props.experiments?.length ?? 0} experiments
    </div>
  ),
}));

const DAY_MS = 24 * 60 * 60 * 1000;

const envelope = (items: unknown[]) => ({
  items,
  page: 1,
  pageSize: 6,
  totalPages: 1,
  totalCount: items.length,
});

const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString();

describe("PublicExperimentsSection", () => {
  it("asks for the six most recently updated public experiments", async () => {
    const spy = server.mount(contract.experiments.listExperiments, { body: envelope([]) });
    render(<PublicExperimentsSection />);

    await waitFor(() => expect(spy.called).toBe(true));
    const query = new URL(spy.url).searchParams;
    expect(query.get("scope")).toBe("all");
    expect(query.get("visibility")).toBe("public");
    expect(query.get("page")).toBe("1");
    expect(query.get("pageSize")).toBe("6");
    expect(query.get("sort[0][field]")).toBe("updated");
    expect(query.get("sort[0][direction]")).toBe("desc");
  });

  it("shows skeletons while loading", () => {
    server.mount(contract.experiments.listExperiments, { body: envelope([]), delay: "infinite" });
    const { container } = render(<PublicExperimentsSection />);

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryByTestId("experiment-cards")).not.toBeInTheDocument();
  });

  it("renders the cards with the Updated label", async () => {
    server.mount(contract.experiments.listExperiments, {
      body: envelope([
        createExperiment({ updatedAt: daysAgo(1) }),
        createExperiment({ updatedAt: daysAgo(2) }),
      ]),
    });
    render(<PublicExperimentsSection />);

    const cards = await screen.findByTestId("experiment-cards");
    expect(cards).toHaveTextContent("2 experiments");
    expect(cards).toHaveAttribute("data-updated-label", "true");
    expect(screen.queryByText(/dashboard.publicExperimentsStale/)).not.toBeInTheDocument();
  });

  it("says nothing is stale while the newest update is under 30 days old", async () => {
    server.mount(contract.experiments.listExperiments, {
      body: envelope([createExperiment({ updatedAt: daysAgo(29) })]),
    });
    render(<PublicExperimentsSection />);

    await screen.findByTestId("experiment-cards");
    expect(screen.queryByText(/dashboard.publicExperimentsStale/)).not.toBeInTheDocument();
  });

  it("keeps the cards and links to the list after 30 days without an update", async () => {
    server.mount(contract.experiments.listExperiments, {
      body: envelope([createExperiment({ updatedAt: daysAgo(31) })]),
    });
    render(<PublicExperimentsSection />);

    expect(await screen.findByText(/dashboard.publicExperimentsStale/)).toBeInTheDocument();
    expect(screen.getByTestId("experiment-cards")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "dashboard.browsePublicExperiments" })).toHaveAttribute(
      "href",
      "/en-US/platform/experiments?visibility=public",
    );
  });

  it("says so when there are no public experiments", async () => {
    server.mount(contract.experiments.listExperiments, { body: envelope([]) });
    render(<PublicExperimentsSection />);

    expect(await screen.findByText("dashboard.noPublicExperiments")).toBeInTheDocument();
    expect(screen.queryByText("dashboard.publicExperimentsLoadFailed")).not.toBeInTheDocument();
  });

  it("shows a separate, retryable message when the request fails", async () => {
    const spy = server.mount(contract.experiments.listExperiments, { status: 500 });
    const user = userEvent.setup();
    render(<PublicExperimentsSection />);

    expect(await screen.findByText("dashboard.publicExperimentsLoadFailed")).toBeInTheDocument();
    expect(screen.queryByText("dashboard.noPublicExperiments")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "errors.tryAgain" }));
    await waitFor(() => expect(spy.callCount).toBeGreaterThan(1));
  });
});
