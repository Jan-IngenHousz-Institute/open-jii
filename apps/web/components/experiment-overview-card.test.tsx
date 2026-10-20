import { createExperiment } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ExperimentOverviewCard, hasBadges } from "./experiment-overview-card";

const renderCard = (showUpdatedLabel = false) =>
  render(
    <ExperimentOverviewCard
      experiment={createExperiment({ visibility: "public" })}
      href="/en-US/platform/experiments/1"
      locale="en-US"
      reserveBadgeRow
      showUpdatedLabel={showUpdatedLabel}
    />,
  );

describe("ExperimentOverviewCard", () => {
  it("shows the update date", () => {
    renderCard();

    expect(screen.getByTitle("columns.updated")).toBeInTheDocument();
    expect(screen.queryByText("updatedOn")).not.toBeInTheDocument();
  });

  it("labels the update date where no column header says what it is", () => {
    renderCard(true);

    expect(screen.getByText("updatedOn")).toBeInTheDocument();
  });

  it("reserves the badge row only for a private or organization-owned experiment", () => {
    expect(hasBadges(createExperiment({ visibility: "public", organizationName: null }))).toBe(
      false,
    );
    expect(hasBadges(createExperiment({ visibility: "private" }))).toBe(true);
    expect(hasBadges(createExperiment({ visibility: "public", organizationName: "Lab" }))).toBe(
      true,
    );
  });
});
