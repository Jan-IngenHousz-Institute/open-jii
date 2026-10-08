import { createExperiment } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ExperimentOverviewCard } from "./experiment-overview-card";

const experiment = createExperiment({ visibility: "public" });
const renderCard = (visit?: Parameters<typeof ExperimentOverviewCard>[0]["visit"]) =>
  render(
    <ExperimentOverviewCard
      experiment={experiment}
      href="/en-US/platform/experiments/1"
      locale="en-US"
      reserveBadgeRow
      visit={visit}
    />,
  );

describe("ExperimentOverviewCard", () => {
  it("shows the caller's role and when they opened it in place of the update date", () => {
    renderCard({ openedAt: "2025-01-20T09:30:00.000Z", callerRole: "owner" });

    expect(screen.getByText("organizations.roles.owner")).toBeInTheDocument();
    expect(screen.getByText("openedOn")).toBeInTheDocument();
    expect(screen.queryByTitle("columns.updated")).not.toBeInTheDocument();
  });

  it("shows no role when none reaches the caller", () => {
    renderCard({ openedAt: "2025-01-20T09:30:00.000Z", callerRole: null });

    expect(screen.queryByText(/organizations\.roles\./)).not.toBeInTheDocument();
    expect(screen.getByText("openedOn")).toBeInTheDocument();
  });

  it("keeps the update date without a visit", () => {
    renderCard();

    expect(screen.getByTitle("columns.updated")).toBeInTheDocument();
    expect(screen.queryByText("openedOn")).not.toBeInTheDocument();
  });
});
