import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { TouchableOpacity } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { JoinCodePreview } from "@repo/api/domains/experiment/join-codes/experiment-join-codes.schema";

import { JoinCodePreviewCard } from "./join-code-preview-card";

vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    i18n: { language: "en-US" },
    t: (key: string, values?: { date?: string }) => {
      if (key === "experiments:joinCode.validUntil") return `valid until ${String(values?.date)}`;
      return (
        {
          "common:retry": "Retry",
          "experiments:joinCode.codeLabel": "Code",
          "experiments:joinCode.noExpiry": "no expiry date",
          "experiments:joinCode.canViewHint":
            "You'll join with Can view: you can take measurements and see the data.",
          "experiments:joinCode.noWorkbookHint": "This experiment has no measurement workbook yet",
          "experiments:joinCode.join": "Join experiment",
          "experiments:joinCode.joining": "Joining…",
          "experiments:joinCode.alreadyMember": "You're already in this experiment",
          "experiments:joinCode.openExperiment": "Open experiment",
          "experiments:joinCode.offlineHint": "You're offline. Reconnect to join.",
        }[key] ?? key
      );
    },
  }),
}));

const PREVIEW: JoinCodePreview = {
  experiment: {
    id: "exp-1",
    name: "Canopy Phi2 Sweep",
    description: "<p>Phi2 across the canopy profile.</p>",
    organizationName: "Canopy Lab",
    status: "active",
    hasWorkbook: true,
  },
  membershipStatus: "none",
  expiresAt: "2026-09-25T12:00:00.000Z",
};

const onJoin = vi.fn();
const onOpen = vi.fn();

function renderCard(preview: JoinCodePreview, overrides?: { isOffline?: boolean }) {
  return render(
    <JoinCodePreviewCard
      code="KP7Q4WMX"
      preview={preview}
      onJoin={onJoin}
      onOpen={onOpen}
      isJoining={false}
      isOffline={overrides?.isOffline ?? false}
    />,
  );
}

beforeEach(() => {
  onJoin.mockClear();
  onOpen.mockClear();
});

describe("JoinCodePreviewCard", () => {
  it("names the experiment, its organization and its description", () => {
    renderCard(PREVIEW);

    expect(screen.getByText("Canopy Phi2 Sweep")).toBeTruthy();
    expect(screen.getByText("Canopy Lab")).toBeTruthy();
    expect(screen.getByText("Phi2 across the canopy profile.")).toBeTruthy();
  });

  it("shows the code hyphenated, with when it stops working", () => {
    renderCard(PREVIEW);

    expect(screen.getByText("KP7Q-4WMX")).toBeTruthy();
    expect(screen.getByText(/valid until 25 Sept? 2026/u)).toBeTruthy();
  });

  it("says a code without an expiry has none, rather than showing an empty date", () => {
    renderCard({ ...PREVIEW, expiresAt: null });

    expect(screen.getByText(/no expiry date/u)).toBeTruthy();
  });

  it("offers Join with the Can view sentence to someone not yet in", () => {
    renderCard(PREVIEW);

    expect(
      screen.getByText("You'll join with Can view: you can take measurements and see the data."),
    ).toBeTruthy();

    fireEvent.press(screen.getByText("Join experiment"));
    expect(onJoin).toHaveBeenCalledOnce();
    expect(screen.queryByText("Open experiment")).toBeNull();
  });

  it("offers Open experiment, not Join, to someone already in", () => {
    renderCard({ ...PREVIEW, membershipStatus: "member" });

    expect(screen.getByText("You're already in this experiment")).toBeTruthy();
    expect(screen.queryByText("Join experiment")).toBeNull();

    fireEvent.press(screen.getByText("Open experiment"));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onJoin).not.toHaveBeenCalled();
  });

  it("warns that there is nothing to measure yet when no workbook is attached", () => {
    renderCard({
      ...PREVIEW,
      experiment: { ...PREVIEW.experiment, hasWorkbook: false },
    });

    expect(screen.getByText("This experiment has no measurement workbook yet")).toBeTruthy();
    // Joining is still allowed: the organizer can attach a workbook later.
    expect(screen.getByText("Join experiment")).toBeTruthy();
  });

  it("does not hint about a workbook when one is attached", () => {
    renderCard(PREVIEW);

    expect(screen.queryByText("This experiment has no measurement workbook yet")).toBeNull();
  });

  it("disables Join and explains why while offline", () => {
    const { UNSAFE_queryAllByType } = renderCard(PREVIEW, { isOffline: true });

    const touchables = UNSAFE_queryAllByType(TouchableOpacity) as {
      props: { disabled?: boolean };
    }[];
    expect(touchables).toHaveLength(1);
    expect(touchables[0]?.props.disabled).toBe(true);
    expect(screen.getByText("You're offline. Reconnect to join.")).toBeTruthy();
  });
});
