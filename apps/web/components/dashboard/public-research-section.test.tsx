import { createExperiment } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { PublicResearchSection } from "./public-research-section";

vi.mock("~/components/experiment-overview-card", () => ({
  hasBadges: () => false,
  ExperimentOverviewCard: (props: { experiment: { name: string }; showUpdatedLabel?: boolean }) => (
    <div data-testid="experiment-card" data-updated-label={String(props.showUpdatedLabel)}>
      {props.experiment.name}
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

const experiments = (count: number, updatedAt = daysAgo(1)) =>
  Array.from({ length: count }, (_, index) =>
    createExperiment({ name: `Public ${index}`, updatedAt }),
  );

describe("PublicResearchSection", () => {
  it("asks for the six most recently updated public experiments", async () => {
    const spy = server.mount(contract.experiments.listExperiments, { body: envelope([]) });
    render(<PublicResearchSection />);

    await waitFor(() => expect(spy.called).toBe(true));
    const query = new URL(spy.url).searchParams;
    expect(query.get("scope")).toBe("all");
    expect(query.get("visibility")).toBe("public");
    expect(query.get("page")).toBe("1");
    expect(query.get("pageSize")).toBe("6");
    expect(query.get("sort[0][field]")).toBe("updated");
    expect(query.get("sort[0][direction]")).toBe("desc");
  });

  it("shows skeletons under its heading while loading", () => {
    server.mount(contract.experiments.listExperiments, { body: envelope([]), delay: "infinite" });
    const { container } = render(<PublicResearchSection />);

    expect(screen.getByRole("heading", { name: "dashboard.publicResearch" })).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it("renders the cards with the Updated label and a See all link", async () => {
    server.mount(contract.experiments.listExperiments, { body: envelope(experiments(2)) });
    render(<PublicResearchSection />);

    const cards = await screen.findAllByTestId("experiment-card");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveAttribute("data-updated-label", "true");
    expect(screen.getByRole("link", { name: "dashboard.seeAll" })).toHaveAttribute(
      "href",
      "/en-US/platform/experiments?visibility=public",
    );
    expect(screen.queryByText(/dashboard.publicExperimentsStale/)).not.toBeInTheDocument();
  });

  it("leaves out the card that would sit alone on a row", async () => {
    server.mount(contract.experiments.listExperiments, { body: envelope(experiments(5)) });
    render(<PublicResearchSection />);

    expect(await screen.findAllByTestId("experiment-card")).toHaveLength(4);
    expect(screen.queryByText("Public 4")).not.toBeInTheDocument();
  });

  it("keeps a single card", async () => {
    server.mount(contract.experiments.listExperiments, { body: envelope(experiments(1)) });
    render(<PublicResearchSection />);

    expect(await screen.findAllByTestId("experiment-card")).toHaveLength(1);
  });

  it("keeps the cards and links to the list after 30 days without an update", async () => {
    server.mount(contract.experiments.listExperiments, {
      body: envelope(experiments(2, daysAgo(31))),
    });
    render(<PublicResearchSection />);

    expect(await screen.findByText(/dashboard.publicExperimentsStale/)).toBeInTheDocument();
    expect(screen.getAllByTestId("experiment-card")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "dashboard.browsePublicExperiments" })).toHaveAttribute(
      "href",
      "/en-US/platform/experiments?visibility=public",
    );
  });

  it("renders nothing, heading included, when there are no public experiments", async () => {
    const spy = server.mount(contract.experiments.listExperiments, { body: envelope([]) });
    const { container } = render(<PublicResearchSection />);

    await waitFor(() => expect(spy.called).toBe(true));
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("shows a retryable message when the request fails", async () => {
    const spy = server.mount(contract.experiments.listExperiments, { status: 500 });
    const user = userEvent.setup();
    render(<PublicResearchSection />);

    expect(await screen.findByText("dashboard.publicExperimentsLoadFailed")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "errors.tryAgain" }));
    await waitFor(() => expect(spy.callCount).toBeGreaterThan(1));
  });
});
