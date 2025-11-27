import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { FEATURE_FLAGS } from "@repo/analytics";

import { ExperimentDelete } from "./experiment-delete";

globalThis.React = React;

/* ----------------------------- Hoisted mocks ---------------------------- */

const toastMock = vi.hoisted(() => vi.fn());
const useExperimentDeleteMock = vi.hoisted(() => vi.fn());
const useLocaleMock = vi.hoisted(() => vi.fn());
const routerPushMock = vi.hoisted(() => vi.fn());
const useFeatureFlagEnabledMock = vi.hoisted(() => vi.fn());

/* --------------------------------- Mocks -------------------------------- */

// i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

// toast
vi.mock("@repo/ui/hooks", () => ({
  toast: toastMock,
}));

// posthog
vi.mock("posthog-js/react", () => ({
  useFeatureFlagEnabled: useFeatureFlagEnabledMock,
}));

// hooks
vi.mock("../../hooks/experiment/useExperimentDelete/useExperimentDelete", () => ({
  useExperimentDelete: useExperimentDeleteMock,
}));

vi.mock("@/hooks/useLocale", () => ({
  useLocale: useLocaleMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
  }),
}));

/* ------------------------------- Test Data ------------------------------- */

const experimentId = "exp-123";
const experimentName = "Test Experiment";

/* -------------------------- Helpers -------------------------- */

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

/* --------------------------------- Setup -------------------------------- */

beforeEach(() => {
  vi.clearAllMocks();

  useExperimentDeleteMock.mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({ ok: true }),
    isPending: false,
  });
  useLocaleMock.mockReturnValue("en");
  useFeatureFlagEnabledMock.mockReturnValue(true); // Default to enabled
});

/* --------------------------------- Tests -------------------------------- */

describe("<ExperimentDelete />", () => {
  it("does not render delete button when feature flag is disabled", () => {
    useFeatureFlagEnabledMock.mockReturnValue(false);

    renderWithClient(
      <ExperimentDelete experimentId={experimentId} experimentName={experimentName} />,
    );

    expect(useFeatureFlagEnabledMock).toHaveBeenCalledWith(FEATURE_FLAGS.EXPERIMENT_DELETION);
    expect(screen.queryByText("experimentSettings.deleteExperiment")).not.toBeInTheDocument();
  });

  it("renders delete button when feature flag is enabled", () => {
    useFeatureFlagEnabledMock.mockReturnValue(true);

    renderWithClient(
      <ExperimentDelete experimentId={experimentId} experimentName={experimentName} />,
    );

    expect(useFeatureFlagEnabledMock).toHaveBeenCalledWith(FEATURE_FLAGS.EXPERIMENT_DELETION);
    expect(screen.getByText("experimentSettings.deleteExperiment")).toBeInTheDocument();
  });

  it("opens delete dialog when delete button is clicked", async () => {
    const user = userEvent.setup();
    useFeatureFlagEnabledMock.mockReturnValue(true);

    renderWithClient(
      <ExperimentDelete experimentId={experimentId} experimentName={experimentName} />,
    );

    const deleteButton = screen.getByText("experimentSettings.deleteExperiment");
    await user.click(deleteButton);

    expect(screen.getAllByText("experimentSettings.deleteExperiment")).toHaveLength(2); // Button and Title
    expect(screen.getByText(/experimentSettings.confirmDelete/)).toBeInTheDocument();
  });

  it("calls deleteExperiment and redirects on success", async () => {
    const user = userEvent.setup();
    const deleteSpy = vi.fn().mockResolvedValue({ ok: true });
    useExperimentDeleteMock.mockReturnValue({ mutateAsync: deleteSpy, isPending: false });
    useFeatureFlagEnabledMock.mockReturnValue(true);

    renderWithClient(
      <ExperimentDelete experimentId={experimentId} experimentName={experimentName} />,
    );

    // Open delete dialog
    const deleteButton = screen.getByText("experimentSettings.deleteExperiment");
    await user.click(deleteButton);

    // Confirm delete
    const confirmButton = screen.getByText("experimentSettings.delete");
    await user.click(confirmButton);

    expect(deleteSpy).toHaveBeenCalledWith(
      {
        params: { id: experimentId },
      },
      expect.objectContaining({
        onSuccess: expect.any(Function) as unknown,
        onError: expect.any(Function) as unknown,
        onSettled: expect.any(Function) as unknown,
      }),
    );

    const call = deleteSpy.mock.calls[0] as [
      unknown,
      { onSuccess: () => void; onError: (err: unknown) => void; onSettled: () => void },
    ];
    call[1].onSuccess();

    expect(toastMock).toHaveBeenCalledWith({
      description: "experimentSettings.experimentDeletedSuccess",
    });
    expect(routerPushMock).toHaveBeenCalledWith("/en/platform/experiments");
  });

  it("displays error toast when delete fails", async () => {
    const user = userEvent.setup();
    const errorMessage = "Delete failed";
    const deleteSpy = vi.fn().mockResolvedValue({ ok: true });
    useExperimentDeleteMock.mockReturnValue({ mutateAsync: deleteSpy, isPending: false });
    useFeatureFlagEnabledMock.mockReturnValue(true);

    renderWithClient(
      <ExperimentDelete experimentId={experimentId} experimentName={experimentName} />,
    );

    // Open delete dialog
    const deleteButton = screen.getByText("experimentSettings.deleteExperiment");
    await user.click(deleteButton);

    // Confirm delete
    const confirmButton = screen.getByText("experimentSettings.delete");
    await user.click(confirmButton);

    const call = deleteSpy.mock.calls[0] as [
      unknown,
      { onSuccess: () => void; onError: (err: unknown) => void; onSettled: () => void },
    ];
    call[1].onError({ body: { message: errorMessage } });

    expect(toastMock).toHaveBeenCalledWith({
      description: errorMessage,
      variant: "destructive",
    });
  });
});
