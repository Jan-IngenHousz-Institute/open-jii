// components/experiment-settings/experiment-visibility-card.test.tsx
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

  it("renders title & general description", () => {
    renderCard();
    expect(
      screen
        .getAllByText("experimentSettings.visibility")
        .find((el) => el.tagName.toLowerCase() === "div"),
    ).toBeInTheDocument();
    expect(screen.getByText("experimentSettings.generalDescription")).toBeInTheDocument();
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

  it("submits with embargo when private (includes embargoUntil)", async () => {
    renderCard({
      initialVisibility: "private",
      embargoUntil: "2026-01-15T23:59:59.999Z",
    });

    // Submit the form
    const submitBtn = screen.getByRole("button", { name: "experimentSettings.save" });
    mutateAsyncMock.mockResolvedValueOnce(undefined);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
    });

    // Assert the payload sent to updateExperiment
    const callArg = mutateAsyncMock.mock.calls[0][0] as {
      params: { id: string };
      body: { visibility: string; embargoUntil?: string };
    };
    expect(callArg).toMatchObject({
      params: { id: "exp-123" },
      body: {
        visibility: "private",
        embargoUntil: "2026-01-15T23:59:59.999Z",
      },
    });

    expect(
      screen.getByText(
        (_, node) =>
          node?.textContent === "experimentSettings.embargoUntilHelperString" ||
          node?.textContent === "newExperiment.embargoUntilHelperString",
      ),
    ).toBeInTheDocument();
  });

  it("submits without embargo when public (visibility only) and Select is disabled", async () => {
    renderCard({
      initialVisibility: "public",
      embargoUntil: "2025-12-31T23:59:59.999Z",
    });

    // Select should be disabled when currentVisibility === "public"
    // The trigger is rendered as a combobox button by the shadcn Select
    const combobox = screen.getByRole("combobox");
    expect(combobox).toBeDisabled();

    const submitBtn = screen.getByRole("button", { name: "experimentSettings.save" });
    mutateAsyncMock.mockResolvedValueOnce(undefined);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
    });

    const callArg = mutateAsyncMock.mock.calls[0][0] as {
      params: { id: string };
      body: { visibility: string; embargoUntil?: string };
    };
    expect(callArg).toMatchObject({
      params: { id: "exp-123" },
      body: {
        visibility: "public",
      },
    });

    // Embargo section should remain hidden
    expect(
      screen.queryByText((_, node) => node?.textContent === "experimentSettings.embargoUntil"),
    ).not.toBeInTheDocument();
  });
});
