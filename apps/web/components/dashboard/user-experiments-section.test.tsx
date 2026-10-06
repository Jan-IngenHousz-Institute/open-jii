import { createRecentlyOpenedExperiment } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { UserExperimentsSection } from "./user-experiments-section";

vi.mock("~/components/dashboard/first-work-cards", () => ({
  FirstWorkCards: () => <div data-testid="first-work-cards" />,
}));

describe("UserExperimentsSection", () => {
  it("asks for the three related experiments the researcher opened last", async () => {
    const spy = server.mount(contract.experiments.listRecentlyOpenedExperiments, { body: [] });

    render(<UserExperimentsSection />);

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.calls[0].query).toEqual({ scope: "related", limit: "3" });
  });

  it("shows skeletons while loading", () => {
    server.mount(contract.experiments.listRecentlyOpenedExperiments, { body: [], delay: 100 });

    render(<UserExperimentsSection />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByTestId("first-work-cards")).not.toBeInTheDocument();
  });

  it("renders the opened experiments in the order the server returned", async () => {
    server.mount(contract.experiments.listRecentlyOpenedExperiments, {
      body: [
        createRecentlyOpenedExperiment({ id: "1", name: "Newest" }),
        createRecentlyOpenedExperiment({ id: "2", name: "Older" }),
      ],
    });

    render(<UserExperimentsSection />);

    const links = await screen.findAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      expect.stringContaining("Newest"),
      expect.stringContaining("Older"),
    ]);
    expect(links[0]).toHaveAttribute("href", "/en-US/platform/experiments/1");
  });

  it("shows the researcher's role and when they opened each experiment", async () => {
    server.mount(contract.experiments.listRecentlyOpenedExperiments, {
      body: [
        createRecentlyOpenedExperiment({ callerRole: "admin" }),
        createRecentlyOpenedExperiment({ callerRole: "member" }),
      ],
    });

    render(<UserExperimentsSection />);

    expect(await screen.findByText("organizations.roles.admin")).toBeInTheDocument();
    expect(screen.getByText("organizations.roles.member")).toBeInTheDocument();
    expect(screen.getAllByText("openedOn")).toHaveLength(2);
  });

  it("offers the first-work cards when the researcher has opened nothing related", async () => {
    server.mount(contract.experiments.listRecentlyOpenedExperiments, { body: [] });

    render(<UserExperimentsSection />);

    expect(await screen.findByTestId("first-work-cards")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("does not offer the first-work cards when the row fails to load", async () => {
    const spy = server.mount(contract.experiments.listRecentlyOpenedExperiments, { status: 500 });

    render(<UserExperimentsSection />);

    await waitFor(() => expect(spy.called).toBe(true));
    expect(screen.queryByTestId("first-work-cards")).not.toBeInTheDocument();
  });
});
