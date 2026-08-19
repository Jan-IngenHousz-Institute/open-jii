import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { ExperimentContributor } from "@repo/api/domains/experiment/contributors/experiment-contributors.schema";

import { ExperimentMembersTrail } from "./experiment-members-trail";

function contributor(userId: string): ExperimentContributor {
  return { userId, firstName: "Ada", lastName: "Lovelace", avatarUrl: null };
}

function renderTrail(props: Partial<React.ComponentProps<typeof ExperimentMembersTrail>> = {}) {
  return render(
    <ExperimentMembersTrail
      contributors={[contributor("u-1")]}
      collaboratorCount={1}
      href="/experiments/exp-1/collaborators"
      {...props}
    />,
  );
}

describe("<ExperimentMembersTrail />", () => {
  it("states the collaborator count, not the number of faces it could show", () => {
    // The faces are grant holders; the count is every row the collaborators tab
    // lists. A card and a tab printing different numbers under one word is the
    // failure this component's total exists to avoid.
    renderTrail({ contributors: [contributor("u-1")], collaboratorCount: 4 });

    // Asserted through the label's own count option rather than as a bare "4" in the
    // DOM: the number has to reach the pluralized string, which is the thing that was
    // wrong when this printed a lowercased tab label beside a raw count.
    expect(screen.getByText("sharing.collaboratorCount:4")).toBeInTheDocument();
  });

  it("sends a count of one through the same pluralized label", () => {
    // The label used to be the Collaborators tab's own name, lowercased and printed
    // after the number, so one collaborator read "1 collaborators" — and lowercasing a
    // noun is wrong in any locale that capitalises them. A count-bearing key is the
    // only shape that can be right in all three.
    renderTrail({ contributors: [contributor("u-1")], collaboratorCount: 1 });

    expect(screen.getByText("sharing.collaboratorCount:1")).toBeInTheDocument();
    expect(screen.queryByText("sharing.collaboratorsTab")).not.toBeInTheDocument();
  });

  it("keys the overflow bubble off the total rather than the visible faces", () => {
    renderTrail({ contributors: [contributor("u-1"), contributor("u-2")], collaboratorCount: 7 });

    expect(screen.getByText("+5")).toBeInTheDocument();
  });

  it("still reports collaborators when none of them may be credited", () => {
    // An organization-owned experiment nobody was granted: real collaborators, no
    // contributor to put a face to. Returning early on the empty list would hide it.
    renderTrail({ contributors: [], collaboratorCount: 3 });

    expect(screen.getByText("sharing.collaboratorCount:3")).toBeInTheDocument();
    expect(screen.queryByText("sharing.noCollaboratorsYet")).not.toBeInTheDocument();
    // No stack at all rather than a lone "+3", which would read as three hidden people.
    expect(screen.queryByText("+3")).not.toBeInTheDocument();
  });

  it("reports a failed read instead of claiming there are none", () => {
    // The count is unknown, not zero — "No collaborators yet" would state as fact
    // something the server never answered.
    renderTrail({ contributors: [], collaboratorCount: 0, isError: true });

    expect(screen.getByText("sharing.loadFailed")).toBeInTheDocument();
    expect(screen.queryByText("sharing.noCollaboratorsYet")).not.toBeInTheDocument();
  });

  it("says there are none only when the count is zero", () => {
    renderTrail({ contributors: [], collaboratorCount: 0 });

    expect(screen.getByText("sharing.noCollaboratorsYet")).toBeInTheDocument();
  });

  it("never shows a negative overflow when the two sets disagree", () => {
    // They are computed apart — a deactivated grant holder counts as a row but is
    // not creditable — so the remainder is clamped rather than trusted.
    renderTrail({ contributors: [contributor("u-1"), contributor("u-2")], collaboratorCount: 1 });

    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });
});
