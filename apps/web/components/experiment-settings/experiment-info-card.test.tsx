import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Experiment, ExperimentMember } from "@repo/api";

import { ExperimentInfoCard } from "./experiment-info-card";

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

// auth
vi.mock("@repo/auth/client", () => ({
  useSession: () => ({
    data: { user: { id: "user-admin" } },
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

const mockExperiment: Experiment = {
  id: experimentId,
  name: "Test Experiment",
  description: "Test Description",
  status: "active",
  visibility: "private",
  createdBy: "user-admin",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-15T00:00:00.000Z",
  embargoUntil: "2025-12-31T23:59:59.999Z",
};

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

const membersData: ExperimentMember[] = [
  {
    role: "admin",
    user: { id: "user-admin", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
    joinedAt: "2024-01-01T00:00:00.000Z",
  },
  {
    role: "member",
    user: {
      id: "user-member",
      firstName: "Grace",
      lastName: "Hopper",
      email: "grace@example.com",
    },
    joinedAt: "2024-01-02T00:00:00.000Z",
  },
];

describe("<ExperimentInfoCard />", () => {
  describe("Rendering", () => {
    it("renders archive note and archive button", () => {
      renderWithClient(
        <ExperimentInfoCard
          experimentId={experimentId}
          experiment={mockExperiment}
          members={membersData}
        />,
      );

      expect(screen.getByText("experimentSettings.archiveNote")).toBeInTheDocument();
      expect(screen.getByText("experimentSettings.archiveExperiment")).toBeInTheDocument();
    });

    it("shows archive button when experiment status is active", () => {
      renderWithClient(
        <ExperimentInfoCard
          experimentId={experimentId}
          experiment={mockExperiment}
          members={membersData}
        />,
      );

      const archiveButton = screen.getByText("experimentSettings.archiveExperiment");
      expect(archiveButton).toBeInTheDocument();
      expect(screen.queryByText("experimentSettings.unarchiveExperiment")).not.toBeInTheDocument();
    });

    it("shows unarchive button when experiment status is archived", () => {
      const archivedExperiment = { ...mockExperiment, status: "archived" as const };

      renderWithClient(
        <ExperimentInfoCard
          experimentId={experimentId}
          experiment={archivedExperiment}
          members={membersData}
        />,
      );

      const unarchiveButton = screen.getByText("experimentSettings.unarchiveExperiment");
      expect(unarchiveButton).toBeInTheDocument();
      expect(screen.queryByText("experimentSettings.archiveExperiment")).not.toBeInTheDocument();
    });

    it("opens archive dialog when archive button is clicked", async () => {
      const user = userEvent.setup();

      renderWithClient(
        <ExperimentInfoCard
          experimentId={experimentId}
          experiment={mockExperiment}
          members={membersData}
        />,
      );

      const archiveButton = screen.getByText("experimentSettings.archiveExperiment");
      await user.click(archiveButton);

      expect(screen.getByText("experimentSettings.archivingExperiment")).toBeInTheDocument();
      expect(screen.getByText("experimentSettings.archiveDescription")).toBeInTheDocument();
    });

    it("opens unarchive dialog when unarchive button is clicked", async () => {
      const user = userEvent.setup();
      const archivedExperiment = { ...mockExperiment, status: "archived" as const };

      renderWithClient(
        <ExperimentInfoCard
          experimentId={experimentId}
          experiment={archivedExperiment}
          members={membersData}
        />,
      );

      const unarchiveButton = screen.getByText("experimentSettings.unarchiveExperiment");
      await user.click(unarchiveButton);

      expect(screen.getByText("experimentSettings.unarchivingExperiment")).toBeInTheDocument();
      expect(screen.getByText("experimentSettings.unarchiveDescription")).toBeInTheDocument();
    });

    it("calls updateExperiment with archived status and redirects on archive", async () => {
      const user = userEvent.setup();
      const updateSpy = vi.fn().mockResolvedValue({ ok: true });
      useExperimentUpdateMock.mockReturnValue({ mutateAsync: updateSpy, isPending: false });

      renderWithClient(
        <ExperimentInfoCard
          experimentId={experimentId}
          experiment={mockExperiment}
          members={membersData}
        />,
      );

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
      expect(routerPushMock).toHaveBeenCalledWith("/en/platform/experiments-archive");
    });

    it("calls updateExperiment with active status and redirects on unarchive", async () => {
      const user = userEvent.setup();
      const updateSpy = vi.fn().mockResolvedValue({ ok: true });
      useExperimentUpdateMock.mockReturnValue({ mutateAsync: updateSpy, isPending: false });
      const archivedExperiment = { ...mockExperiment, status: "archived" as const };

      renderWithClient(
        <ExperimentInfoCard
          experimentId={experimentId}
          experiment={archivedExperiment}
          members={membersData}
        />,
      );

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
      expect(routerPushMock).toHaveBeenCalledWith("/en/platform/experiments");
    });

    it("displays error toast when archive fails", async () => {
      const user = userEvent.setup();
      const errorMessage = "Archive failed";
      const updateSpy = vi.fn().mockResolvedValue({ ok: true });
      useExperimentUpdateMock.mockReturnValue({ mutateAsync: updateSpy, isPending: false });

      renderWithClient(
        <ExperimentInfoCard
          experimentId={experimentId}
          experiment={mockExperiment}
          members={membersData}
        />,
      );

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

    it("displays generic error toast when unarchive fails without message", async () => {
      const user = userEvent.setup();
      const updateSpy = vi.fn().mockResolvedValue({ ok: true });
      useExperimentUpdateMock.mockReturnValue({ mutateAsync: updateSpy, isPending: false });
      const archivedExperiment = { ...mockExperiment, status: "archived" as const };

      renderWithClient(
        <ExperimentInfoCard
          experimentId={experimentId}
          experiment={archivedExperiment}
          members={membersData}
        />,
      );

      // Open unarchive dialog
      const unarchiveButton = screen.getByText("experimentSettings.unarchiveExperiment");
      await user.click(unarchiveButton);

      // Confirm unarchive
      const confirmButton = screen.getByText("experimentSettings.unarchiveActivate");
      await user.click(confirmButton);

      const call = updateSpy.mock.calls[0] as [
        unknown,
        { onSuccess: () => void; onError: (err: unknown) => void; onSettled: () => void },
      ];
      call[1].onError(new Error("Network error"));

      expect(toastMock).toHaveBeenCalledWith({
        description: "experimentSettings.experimentUnarchivedError",
        variant: "destructive",
      });
    });
  });
});
