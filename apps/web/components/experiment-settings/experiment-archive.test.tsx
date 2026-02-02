import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ExperimentArchive } from "./experiment-archive";

globalThis.React = React;

/* ----------------------------- Hoisted mocks ---------------------------- */

const toastMock = vi.hoisted(() => vi.fn());
const useExperimentUpdateMock = vi.hoisted(() => vi.fn());
const useLocaleMock = vi.hoisted(() => vi.fn());
const routerPushMock = vi.hoisted(() => vi.fn());

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

// hooks
vi.mock("../../hooks/experiment/useExperimentUpdate/useExperimentUpdate", () => ({
  useExperimentUpdate: useExperimentUpdateMock,
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

  useExperimentUpdateMock.mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({ ok: true }),
    isPending: false,
  });
  useLocaleMock.mockReturnValue("en");
});

/* --------------------------------- Tests -------------------------------- */

describe("<ExperimentArchive />", () => {
  it("renders archive button when not archived", () => {
    renderWithClient(<ExperimentArchive experimentId={experimentId} isArchived={false} />);

    expect(screen.getByText("experimentSettings.archiveExperiment")).toBeInTheDocument();
    expect(screen.queryByText("experimentSettings.unarchiveExperiment")).not.toBeInTheDocument();
  });

  it("renders unarchive button when archived", () => {
    renderWithClient(<ExperimentArchive experimentId={experimentId} isArchived={true} />);

    expect(screen.getByText("experimentSettings.unarchiveExperiment")).toBeInTheDocument();
    expect(screen.queryByText("experimentSettings.archiveExperiment")).not.toBeInTheDocument();
  });

  it("opens archive dialog when archive button is clicked", async () => {
    const user = userEvent.setup();

    renderWithClient(<ExperimentArchive experimentId={experimentId} isArchived={false} />);

    const archiveButton = screen.getByText("experimentSettings.archiveExperiment");
    await user.click(archiveButton);

    expect(screen.getByText("experimentSettings.archivingExperiment")).toBeInTheDocument();
    expect(screen.getByText("experimentSettings.archiveDescription")).toBeInTheDocument();
  });

  it("calls updateExperiment with archived status and redirects on archive", async () => {
    const user = userEvent.setup();
    const updateSpy = vi.fn().mockResolvedValue({ ok: true });
    useExperimentUpdateMock.mockReturnValue({ mutateAsync: updateSpy, isPending: false });

    renderWithClient(<ExperimentArchive experimentId={experimentId} isArchived={false} />);

    // Open archive dialog
    const archiveButton = screen.getByText("experimentSettings.archiveExperiment");
    await user.click(archiveButton);

    // Confirm archive
    const confirmButton = screen.getByText("experimentSettings.archiveDeactivate");
    await user.click(confirmButton);

    expect(updateSpy).toHaveBeenCalledWith(
      {
        params: { id: experimentId },
        body: { status: "archived" },
      },
      expect.objectContaining({
        onSuccess: expect.any(Function) as unknown,
        onError: expect.any(Function) as unknown,
        onSettled: expect.any(Function) as unknown,
      }),
    );

    const call = updateSpy.mock.calls[0] as [
      unknown,
      { onSuccess: () => void; onError: (err: unknown) => void; onSettled: () => void },
    ];
    call[1].onSuccess();

    expect(toastMock).toHaveBeenCalledWith({
      description: "experimentSettings.experimentArchivedSuccess",
    });
    expect(routerPushMock).toHaveBeenCalledWith(`/en/platform/experiments-archive/${experimentId}`);
  });

  it("calls updateExperiment with active status and redirects on unarchive", async () => {
    const user = userEvent.setup();
    const updateSpy = vi.fn().mockResolvedValue({ ok: true });
    useExperimentUpdateMock.mockReturnValue({ mutateAsync: updateSpy, isPending: false });

    renderWithClient(<ExperimentArchive experimentId={experimentId} isArchived={true} />);

    // Open unarchive dialog
    const unarchiveButton = screen.getByText("experimentSettings.unarchiveExperiment");
    await user.click(unarchiveButton);

    // Confirm unarchive
    const confirmButton = screen.getByText("experimentSettings.unarchiveActivate");
    await user.click(confirmButton);

    expect(updateSpy).toHaveBeenCalledWith(
      {
        params: { id: experimentId },
        body: { status: "active" },
      },
      expect.objectContaining({
        onSuccess: expect.any(Function) as unknown,
        onError: expect.any(Function) as unknown,
        onSettled: expect.any(Function) as unknown,
      }),
    );

    const call = updateSpy.mock.calls[0] as [
      unknown,
      { onSuccess: () => void; onError: (err: unknown) => void; onSettled: () => void },
    ];
    call[1].onSuccess();

    expect(toastMock).toHaveBeenCalledWith({
      description: "experimentSettings.experimentUnarchivedSuccess",
    });
    expect(routerPushMock).toHaveBeenCalledWith(`/en/platform/experiments/${experimentId}`);
  });

  it("displays error toast when archive fails", async () => {
    const user = userEvent.setup();
    const errorMessage = "Archive failed";
    const updateSpy = vi.fn().mockResolvedValue({ ok: true });
    useExperimentUpdateMock.mockReturnValue({ mutateAsync: updateSpy, isPending: false });

    renderWithClient(<ExperimentArchive experimentId={experimentId} isArchived={false} />);

    // Open archive dialog
    const archiveButton = screen.getByText("experimentSettings.archiveExperiment");
    await user.click(archiveButton);

    // Confirm archive
    const confirmButton = screen.getByText("experimentSettings.archiveDeactivate");
    await user.click(confirmButton);

    const call = updateSpy.mock.calls[0] as [
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
