// components/experiment-settings/experiment-visibility-card.test.tsx
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ExperimentVisibilityCard } from "./experiment-visibility-card";

globalThis.React = React;

// --- mock i18n to return keys
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

// --- mock toast (no-op)
vi.mock("@repo/ui/hooks", () => ({
  toast: vi.fn(),
}));

// --- mock useExperimentUpdate to capture payload and resolve
const mutateAsyncMock = vi.fn();
vi.mock("../../hooks/experiment/useExperimentUpdate/useExperimentUpdate", () => ({
  useExperimentUpdate: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

describe("<ExperimentVisibilityCard />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderCard(props?: Partial<React.ComponentProps<typeof ExperimentVisibilityCard>>) {
    const defaultProps: React.ComponentProps<typeof ExperimentVisibilityCard> = {
      experimentId: "exp-123",
      initialVisibility: "private",
      embargoUntil: "2025-12-31T23:59:59.999Z",
    };
    return render(<ExperimentVisibilityCard {...defaultProps} {...props} />);
  }

  it("renders title and description", () => {
    renderCard();
    expect(screen.getByText("Actions")).toBeInTheDocument();
    expect(
      screen.getByText("Set the page to public or private to control who can see it."),
    ).toBeInTheDocument();
  });

  it("shows embargo field when visibility is private", () => {
    renderCard({ initialVisibility: "private" });

    expect(
      screen.getByText((_, node) => node?.textContent === "experimentSettings.embargoUntil"),
    ).toBeInTheDocument();
  });

  it("hides embargo field when visibility is public", () => {
    renderCard({ initialVisibility: "public" });

    expect(
      screen.queryByText((_, node) => node?.textContent === "experimentSettings.embargoUntil"),
    ).not.toBeInTheDocument();

    expect(screen.getByText("experimentSettings.visibilityCannotBeChanged")).toBeInTheDocument();
  });

  it("shows embargo field with helper text when visibility is private", () => {
    renderCard({
      initialVisibility: "private",
      embargoUntil: "2026-01-15T23:59:59.999Z",
    });

    // Should show embargo field with date
    expect(screen.getByText("experimentSettings.embargoUntil")).toBeInTheDocument();
    // Check for date button (format may vary by timezone)
    expect(screen.getByRole("button", { name: /Jan 1[56], 2026/ })).toBeInTheDocument();
    expect(screen.getByText("newExperiment.embargoUntilHelperString")).toBeInTheDocument();
  });

  it("disables visibility select when public and shows warning message", () => {
    renderCard({
      initialVisibility: "public",
      embargoUntil: "2025-12-31T23:59:59.999Z",
    });

    // Select should be disabled when currentVisibility === "public"
    const combobox = screen.getByRole("combobox");
    expect(combobox).toBeDisabled();

    // Should show warning that visibility cannot be changed
    expect(screen.getByText("experimentSettings.visibilityCannotBeChanged")).toBeInTheDocument();

    // Embargo section should be hidden for public experiments
    expect(
      screen.queryByText((_, node) => node?.textContent === "experimentSettings.embargoUntil"),
    ).not.toBeInTheDocument();
  });
});
