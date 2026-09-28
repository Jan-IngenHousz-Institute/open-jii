import { fireEvent, render, screen } from "@testing-library/react-native";
import { FlaskConical } from "lucide-react-native";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { ExperimentListItem } from "@repo/api/domains/experiment/experiment.schema";

import { DiscoverExperimentRow } from "./discover-experiment-row";

vi.mock("~/shared/ui/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({ inactive: "#777777" }),
}));
vi.mock("~/shared/constants/colors", () => ({ colors: { jii: { darkGreen: "#004000" } } }));
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { count?: number }) => {
      if (key === "discover:collaborators") {
        return `${String(values?.count)} ${values?.count === 1 ? "collaborator" : "collaborators"}`;
      }
      return (
        {
          "experiments:membership.joined": "Joined",
          "experiments:membership.requested": "Requested",
          "experiments:status.stale": "Stale",
          "experiments:status.published": "Published",
          "experiments:status.archived": "Archived",
        }[key] ?? key
      );
    },
  }),
}));

function entry(overrides: Partial<ExperimentListItem> = {}): ExperimentListItem {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Canopy Phi2 Sweep",
    description: null,
    status: "active",
    visibility: "public",
    embargoUntil: null,
    organizationId: "00000000-0000-4000-8000-0000000000aa",
    organizationName: "Canopy Lab",
    createdBy: "00000000-0000-4000-8000-0000000000bb",
    membersCount: 6,
    membershipStatus: "none",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  } as ExperimentListItem;
}

describe("DiscoverExperimentRow", () => {
  it("names the organization and counts the collaborators", () => {
    render(<DiscoverExperimentRow experiment={entry()} onPress={vi.fn()} />);

    expect(screen.getByText("Canopy Phi2 Sweep")).toBeTruthy();
    expect(screen.getByText("Canopy Lab · 6 collaborators")).toBeTruthy();
  });

  it("uses the singular form for a one-person experiment", () => {
    render(<DiscoverExperimentRow experiment={entry({ membersCount: 1 })} onPress={vi.fn()} />);

    expect(screen.getByText("Canopy Lab · 1 collaborator")).toBeTruthy();
  });

  it("omits a missing organization rather than leaving a separator", () => {
    render(
      <DiscoverExperimentRow experiment={entry({ organizationName: null })} onPress={vi.fn()} />,
    );

    expect(screen.getByText("6 collaborators")).toBeTruthy();
  });

  it("omits a missing collaborator count rather than leaving a separator", () => {
    render(
      <DiscoverExperimentRow experiment={entry({ membersCount: undefined })} onPress={vi.fn()} />,
    );

    expect(screen.getByText("Canopy Lab")).toBeTruthy();
  });

  it("drops the whole second line when both are missing", () => {
    render(
      <DiscoverExperimentRow
        experiment={entry({ organizationName: null, membersCount: undefined })}
        onPress={vi.fn()}
      />,
    );

    expect(screen.getByText("Canopy Phi2 Sweep")).toBeTruthy();
    expect(screen.queryByText(" · ")).toBeNull();
  });

  it("keeps a zero collaborator count, which is a real answer", () => {
    render(<DiscoverExperimentRow experiment={entry({ membersCount: 0 })} onPress={vi.fn()} />);

    expect(screen.getByText("Canopy Lab · 0 collaborators")).toBeTruthy();
  });

  it("shows no tag for an experiment the caller has no relationship with", () => {
    render(<DiscoverExperimentRow experiment={entry()} onPress={vi.fn()} />);

    expect(screen.queryByText("Joined")).toBeNull();
    expect(screen.queryByText("Requested")).toBeNull();
  });

  it("tags a member as Joined", () => {
    render(
      <DiscoverExperimentRow
        experiment={entry({ membershipStatus: "member" })}
        onPress={vi.fn()}
      />,
    );

    expect(screen.getByText("Joined")).toBeTruthy();
    expect(screen.queryByText("Requested")).toBeNull();
  });

  it("tags a pending request as Requested", () => {
    render(
      <DiscoverExperimentRow
        experiment={entry({ membershipStatus: "pending_request" })}
        onPress={vi.fn()}
      />,
    );

    expect(screen.getByText("Requested")).toBeTruthy();
    expect(screen.queryByText("Joined")).toBeNull();
  });

  it("truncates a long name to one line so the tag keeps its slot", () => {
    render(
      <DiscoverExperimentRow
        experiment={entry({
          name: "Wageningen Canopy Photosynthesis Atlas, Tuesday Field Workshop Group",
          membershipStatus: "member",
        })}
        onPress={vi.fn()}
      />,
    );

    const name = screen.getByText(
      "Wageningen Canopy Photosynthesis Atlas, Tuesday Field Workshop Group",
    );
    expect(name.props.numberOfLines).toBe(1);
    expect(screen.getByText("Joined")).toBeTruthy();
  });

  it("hands the experiment id back on press", () => {
    const onPress = vi.fn();
    render(<DiscoverExperimentRow experiment={entry()} onPress={onPress} />);

    fireEvent.press(screen.getByText("Canopy Phi2 Sweep"));

    expect(onPress).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001");
  });
  it("carries the flask tile the organization rows have, so the two read alike", () => {
    render(<DiscoverExperimentRow experiment={entry()} onPress={vi.fn()} />);

    expect(screen.UNSAFE_getByType(FlaskConical)).toBeTruthy();
  });

  describe("the status tag", () => {
    it("says nothing for an active experiment, the unremarkable case", () => {
      render(<DiscoverExperimentRow experiment={entry({ status: "active" })} onPress={vi.fn()} />);

      expect(screen.queryByText("Stale")).toBeNull();
      expect(screen.queryByText("Published")).toBeNull();
      expect(screen.queryByText("Archived")).toBeNull();
    });

    it.each([
      ["stale", "Stale"],
      ["published", "Published"],
      ["archived", "Archived"],
    ] as const)("tags a %s experiment", (status, label) => {
      render(<DiscoverExperimentRow experiment={entry({ status })} onPress={vi.fn()} />);

      expect(screen.getByText(label)).toBeTruthy();
    });

    it("sits alongside the membership tag rather than replacing it", () => {
      render(
        <DiscoverExperimentRow
          experiment={entry({ status: "archived", membershipStatus: "member" })}
          onPress={vi.fn()}
        />,
      );

      expect(screen.getByText("Joined")).toBeTruthy();
      expect(screen.getByText("Archived")).toBeTruthy();
    });
  });
});
