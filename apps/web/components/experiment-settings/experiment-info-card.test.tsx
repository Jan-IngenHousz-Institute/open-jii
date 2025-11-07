import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Experiment } from "@repo/api";

import { ExperimentInfoCard } from "./experiment-info-card";

globalThis.React = React;

/* -------------------------------- Types -------------------------------- */

interface Member {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
  };
  role: "admin" | "member";
  joinedAt?: string;
}

/* ----------------------------- Hoisted mocks ---------------------------- */

const toastMock = vi.hoisted(() => vi.fn());
const useExperimentMembersMock = vi.hoisted(() => vi.fn());
const useExperimentDeleteMock = vi.hoisted(() => vi.fn());
const useExperimentUpdateMock = vi.hoisted(() => vi.fn());
const useLocaleMock = vi.hoisted(() => vi.fn());
const routerPushMock = vi.hoisted(() => vi.fn());
const formatDateMock = vi.hoisted(() => vi.fn());

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
vi.mock("../../hooks/experiment/useExperimentMembers/useExperimentMembers", () => ({
  useExperimentMembers: useExperimentMembersMock,
}));

vi.mock("../../hooks/experiment/useExperimentDelete/useExperimentDelete", () => ({
  useExperimentDelete: useExperimentDeleteMock,
}));

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

vi.mock("@/util/date", () => ({
  formatDate: formatDateMock,
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

const membersBody: Member[] = [
  {
    role: "admin",
    user: { id: "user-admin", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
  },
  {
    role: "member",
    user: { id: "user-member", firstName: "Grace", lastName: "Hopper", email: "grace@example.com" },
  },
];

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

const defaultMockReturns = {
  members: { data: { body: membersBody }, isLoading: false, isError: false },
  experimentDelete: { mutateAsync: vi.fn().mockResolvedValue({ ok: true }), isPending: false },
  experimentUpdate: { mutateAsync: vi.fn().mockResolvedValue({ ok: true }), isPending: false },
};

/* --------------------------------- Setup -------------------------------- */

beforeEach(() => {
  vi.clearAllMocks();

  useExperimentMembersMock.mockReturnValue(defaultMockReturns.members);
  useExperimentDeleteMock.mockReturnValue(defaultMockReturns.experimentDelete);
  useExperimentUpdateMock.mockReturnValue(defaultMockReturns.experimentUpdate);
  useLocaleMock.mockReturnValue("en");
  formatDateMock.mockImplementation((date: string) => date);
});

/* --------------------------------- Tests -------------------------------- */

describe("<ExperimentInfoCard />", () => {
  describe("Rendering", () => {
    it("renders title and description", () => {
      renderWithClient(
        <ExperimentInfoCard experimentId={experimentId} experiment={mockExperiment} />,
      );

      expect(screen.getByText("experimentSettings.generalSettings")).toBeInTheDocument();
      expect(screen.getByText("experimentSettings.generalDescription")).toBeInTheDocument();
    });

    it("displays admin name and email from members data", () => {
      renderWithClient(
        <ExperimentInfoCard experimentId={experimentId} experiment={mockExperiment} />,
      );

      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
      expect(screen.getByText("ada@example.com")).toBeInTheDocument();
      // Mail icon should be rendered
      const mailIcon = screen.getByText("ada@example.com").parentElement?.querySelector("svg");
      expect(mailIcon).toBeInTheDocument();
    });

    it("displays formatted creation and update dates", () => {
      formatDateMock.mockImplementation((date: string) => `formatted-${date}`);

      renderWithClient(
        <ExperimentInfoCard experimentId={experimentId} experiment={mockExperiment} />,
      );

      expect(screen.getByText("formatted-2024-01-01T00:00:00.000Z")).toBeInTheDocument();
      expect(screen.getByText("formatted-2024-01-15T00:00:00.000Z")).toBeInTheDocument();
      expect(formatDateMock).toHaveBeenCalledWith(mockExperiment.createdAt);
      expect(formatDateMock).toHaveBeenCalledWith(mockExperiment.updatedAt);
    });

    it("displays 'Unknown User' when no admin member is found", () => {
      useExperimentMembersMock.mockReturnValue({
        data: {
          body: [
            {
              role: "member",
              user: {
                id: "user-member",
                firstName: "Grace",
                lastName: "Hopper",
                email: "grace@example.com",
              },
            },
          ],
        },
        isLoading: false,
        isError: false,
      });

      renderWithClient(
        <ExperimentInfoCard experimentId={experimentId} experiment={mockExperiment} />,
      );

      expect(screen.getByText("experimentSettings.unknownUser")).toBeInTheDocument();
    });

    it("renders danger zone section", () => {
      renderWithClient(
        <ExperimentInfoCard experimentId={experimentId} experiment={mockExperiment} />,
      );

      expect(screen.getByText("experimentSettings.dangerZone")).toBeInTheDocument();
      expect(screen.getByText("experimentSettings.deleteWarning")).toBeInTheDocument();
    });
  });

  describe("Archive/Unarchive Functionality", () => {
    it("shows archive button when experiment status is active", () => {
      renderWithClient(
        <ExperimentInfoCard experimentId={experimentId} experiment={mockExperiment} />,
      );

      const archiveButton = screen.getByText("experimentSettings.archiveExperiment");
      expect(archiveButton).toBeInTheDocument();
      expect(screen.queryByText("experimentSettings.unarchiveExperiment")).not.toBeInTheDocument();
    });

    it("shows unarchive button when experiment status is archived", () => {
      const archivedExperiment = { ...mockExperiment, status: "archived" as const };

      renderWithClient(
        <ExperimentInfoCard experimentId={experimentId} experiment={archivedExperiment} />,
      );

      const unarchiveButton = screen.getByText("experimentSettings.unarchiveExperiment");
      expect(unarchiveButton).toBeInTheDocument();
      expect(screen.queryByText("experimentSettings.archiveExperiment")).not.toBeInTheDocument();
    });

    it("opens archive dialog when archive button is clicked", async () => {
      const user = userEvent.setup();

      renderWithClient(
        <ExperimentInfoCard experimentId={experimentId} experiment={mockExperiment} />,
      );

      const archiveButton = screen.getByText("experimentSettings.archiveExperiment");
      await user.click(archiveButton);

      expect(screen.getByText("experimentSettings.archivingExperiment")).toBeInTheDocument();
      expect(
        screen.getByText((content, element) => {
          return (
            element?.tagName.toLowerCase() === "p" &&
            content.includes("experimentSettings.archiveDescription") &&
            content.includes("experimentSettings.confirmArchive")
          );
        }),
      ).toBeInTheDocument();
    });

    it("opens unarchive dialog when unarchive button is clicked", async () => {
      const user = userEvent.setup();
      const archivedExperiment = { ...mockExperiment, status: "archived" as const };

      renderWithClient(
        <ExperimentInfoCard experimentId={experimentId} experiment={archivedExperiment} />,
      );

      const unarchiveButton = screen.getByText("experimentSettings.unarchiveExperiment");
      await user.click(unarchiveButton);

      expect(screen.getByText("experimentSettings.unarchivingExperiment")).toBeInTheDocument();
      expect(
        screen.getByText((content, element) => {
          return (
            element?.tagName.toLowerCase() === "p" &&
            content.includes("experimentSettings.unarchiveDescription") &&
            content.includes("experimentSettings.confirmUnarchive")
          );
        }),
      ).toBeInTheDocument();
    });

    it("calls updateExperiment with archived status and redirects on archive", async () => {
      const user = userEvent.setup();
      const updateSpy = vi.fn().mockResolvedValue({ ok: true });
      useExperimentUpdateMock.mockReturnValue({ mutateAsync: updateSpy, isPending: false });

      renderWithClient(
        <ExperimentInfoCard experimentId={experimentId} experiment={mockExperiment} />,
      );

      // Open archive dialog
      const archiveButton = screen.getByText("experimentSettings.archiveExperiment");
      await user.click(archiveButton);

      // Confirm archive
      const confirmButton = screen.getByText("experimentSettings.archiveDeactivate");
      await user.click(confirmButton);

      expect(updateSpy).toHaveBeenCalledWith({
        params: { id: experimentId },
        body: { status: "archived" },
      });

      await waitFor(() => {
        expect(toastMock).toHaveBeenCalledWith({
          description: "experimentSettings.experimentArchivedSuccess",
        });
      });

      await waitFor(() => {
        expect(routerPushMock).toHaveBeenCalledWith("/en/platform/experiments-archive");
      });
    });

    it("calls updateExperiment with active status and redirects on unarchive", async () => {
      const user = userEvent.setup();
      const updateSpy = vi.fn().mockResolvedValue({ ok: true });
      useExperimentUpdateMock.mockReturnValue({ mutateAsync: updateSpy, isPending: false });
      const archivedExperiment = { ...mockExperiment, status: "archived" as const };

      renderWithClient(
        <ExperimentInfoCard experimentId={experimentId} experiment={archivedExperiment} />,
      );

      // Open unarchive dialog
      const unarchiveButton = screen.getByText("experimentSettings.unarchiveExperiment");
      await user.click(unarchiveButton);

      // Confirm unarchive
      const confirmButton = screen.getByText("experimentSettings.unarchiveActivate");
      await user.click(confirmButton);

      expect(updateSpy).toHaveBeenCalledWith({
        params: { id: experimentId },
        body: { status: "active" },
      });

      await waitFor(() => {
        expect(toastMock).toHaveBeenCalledWith({
          description: "experimentSettings.experimentUnarchivedSuccess",
        });
      });

      await waitFor(() => {
        expect(routerPushMock).toHaveBeenCalledWith("/en/platform/experiments");
      });
    });

    it("displays error toast when archive fails", async () => {
      const user = userEvent.setup();
      const errorMessage = "Archive failed";
      const updateSpy = vi.fn().mockRejectedValue({ body: { message: errorMessage } } as never);
      useExperimentUpdateMock.mockReturnValue({ mutateAsync: updateSpy, isPending: false });

      renderWithClient(
        <ExperimentInfoCard experimentId={experimentId} experiment={mockExperiment} />,
      );

      // Open archive dialog
      const archiveButton = screen.getByText("experimentSettings.archiveExperiment");
      await user.click(archiveButton);

      // Confirm archive
      const confirmButton = screen.getByText("experimentSettings.archiveDeactivate");
      await user.click(confirmButton);

      await waitFor(() => {
        expect(toastMock).toHaveBeenCalledWith({
          description: errorMessage,
          variant: "destructive",
        });
      });
    });

    it("displays generic error toast when unarchive fails without message", async () => {
      const user = userEvent.setup();
      const updateSpy = vi.fn().mockRejectedValue(new Error("Network error") as never);
      useExperimentUpdateMock.mockReturnValue({ mutateAsync: updateSpy, isPending: false });
      const archivedExperiment = { ...mockExperiment, status: "archived" as const };

      renderWithClient(
        <ExperimentInfoCard experimentId={experimentId} experiment={archivedExperiment} />,
      );

      // Open unarchive dialog
      const unarchiveButton = screen.getByText("experimentSettings.unarchiveExperiment");
      await user.click(unarchiveButton);

      // Confirm unarchive
      const confirmButton = screen.getByText("experimentSettings.unarchiveActivate");
      await user.click(confirmButton);

      await waitFor(() => {
        expect(toastMock).toHaveBeenCalledWith({
          description: "experimentSettings.experimentUnarchivedError",
          variant: "destructive",
        });
      });
    });
  });

  describe("Delete Functionality", () => {
    it("renders delete button", () => {
      renderWithClient(
        <ExperimentInfoCard experimentId={experimentId} experiment={mockExperiment} />,
      );

      const deleteButton = screen.getByText("experimentSettings.deleteExperiment");
      expect(deleteButton).toBeInTheDocument();
    });

    it("opens delete confirmation dialog when delete button is clicked", async () => {
      const user = userEvent.setup();

      renderWithClient(
        <ExperimentInfoCard experimentId={experimentId} experiment={mockExperiment} />,
      );

      const deleteButton = screen.getByText("experimentSettings.deleteExperiment");
      await user.click(deleteButton);

      expect(
        screen.getByText((content, element) => {
          return (
            element?.tagName.toLowerCase() === "h2" &&
            content === "experimentSettings.deleteExperiment"
          );
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByText((content, element) => {
          return (
            element?.tagName.toLowerCase() === "p" &&
            content.includes("experimentSettings.confirmDelete")
          );
        }),
      ).toBeInTheDocument();
    });

    it("calls deleteExperiment and redirects when delete is confirmed", async () => {
      const user = userEvent.setup();
      const deleteSpy = vi.fn().mockResolvedValue({ ok: true });
      useExperimentDeleteMock.mockReturnValue({ mutateAsync: deleteSpy, isPending: false });

      renderWithClient(
        <ExperimentInfoCard experimentId={experimentId} experiment={mockExperiment} />,
      );

      // Open delete dialog
      const deleteButton = screen.getByText("experimentSettings.deleteExperiment");
      await user.click(deleteButton);

      // Confirm delete
      const confirmButton = screen.getByText("experimentSettings.delete");
      await user.click(confirmButton);

      expect(deleteSpy).toHaveBeenCalledWith({ params: { id: experimentId } });

      await waitFor(() => {
        expect(routerPushMock).toHaveBeenCalledWith("/en/platform/experiments");
      });
    });

    it("closes delete dialog when cancel is clicked", async () => {
      const user = userEvent.setup();

      renderWithClient(
        <ExperimentInfoCard experimentId={experimentId} experiment={mockExperiment} />,
      );

      // Open delete dialog
      const deleteButton = screen.getByText("experimentSettings.deleteExperiment");
      await user.click(deleteButton);

      // Click cancel
      const cancelButtons = screen.getAllByText("experimentSettings.cancel");
      const deleteDialogCancelButton = cancelButtons[0]; // First cancel button is for delete dialog
      await user.click(deleteDialogCancelButton);

      // Dialog should be closed (title should not be visible)
      await waitFor(() => {
        const dialogTitle = screen.queryByText((content, element) => {
          return (
            element?.tagName.toLowerCase() === "h2" &&
            content === "experimentSettings.deleteExperiment"
          );
        });
        expect(dialogTitle).not.toBeInTheDocument();
      });
    });
  });

  describe("Dialog State Management", () => {
    it("closes delete dialog when cancel is clicked", async () => {
      const user = userEvent.setup();

      renderWithClient(
        <ExperimentInfoCard experimentId={experimentId} experiment={mockExperiment} />,
      );

      // Open delete dialog
      const deleteButton = screen.getByText("experimentSettings.deleteExperiment");
      await user.click(deleteButton);

      // Click cancel
      const cancelButtons = screen.getAllByText("experimentSettings.cancel");
      const deleteDialogCancelButton = cancelButtons[0]; // First cancel button is for delete dialog
      await user.click(deleteDialogCancelButton);

      // Dialog should be closed (title should not be visible)
      await waitFor(() => {
        const dialogTitle = screen.queryByText((content, element) => {
          return (
            element?.tagName.toLowerCase() === "h2" &&
            content === "experimentSettings.deleteExperiment"
          );
        });
        expect(dialogTitle).not.toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles empty members data gracefully", () => {
      useExperimentMembersMock.mockReturnValue({
        data: { body: [] },
        isLoading: false,
        isError: false,
      });

      renderWithClient(
        <ExperimentInfoCard experimentId={experimentId} experiment={mockExperiment} />,
      );

      expect(screen.getByText("experimentSettings.unknownUser")).toBeInTheDocument();
    });

    it("handles undefined members data body gracefully", () => {
      useExperimentMembersMock.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
      });

      renderWithClient(
        <ExperimentInfoCard experimentId={experimentId} experiment={mockExperiment} />,
      );

      expect(screen.getByText("experimentSettings.unknownUser")).toBeInTheDocument();
    });

    it("handles member with null email", () => {
      useExperimentMembersMock.mockReturnValue({
        data: {
          body: [
            {
              role: "admin",
              user: {
                id: "user-admin",
                firstName: "Ada",
                lastName: "Lovelace",
                email: null,
              },
            },
          ],
        },
        isLoading: false,
        isError: false,
      });

      renderWithClient(
        <ExperimentInfoCard experimentId={experimentId} experiment={mockExperiment} />,
      );

      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
      // Mail icon should be rendered even with null email
      const adminSection = screen.getByText("Ada Lovelace").parentElement;
      expect(adminSection).toBeInTheDocument();
    });

    it("renders with different locale", () => {
      useLocaleMock.mockReturnValue("de");

      renderWithClient(
        <ExperimentInfoCard experimentId={experimentId} experiment={mockExperiment} />,
      );

      // Component should still render
      expect(screen.getByText("experimentSettings.generalSettings")).toBeInTheDocument();
    });
  });
});
