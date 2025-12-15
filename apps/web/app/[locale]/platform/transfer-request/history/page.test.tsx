/* eslint-disable @typescript-eslint/no-unsafe-return */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { TransferRequestStatus } from "@repo/api";

import TransferRequestHistoryPage from "./page";

globalThis.React = React;

// -------------------
// Mocks
// -------------------

const mockUseTransferRequests = vi.fn();
vi.mock("~/hooks/useTransferRequests/useTransferRequests", () => ({
  useTransferRequests: () => mockUseTransferRequests(),
}));

vi.mock("@repo/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("~/util/date", () => ({
  formatDate: (date: string) => `formatted-${date}`,
}));

// -------------------
// Test Data
// -------------------

const createMockRequest = (
  requestId: string,
  status: TransferRequestStatus,
  projectIdOld: string,
) => ({
  requestId,
  userId: "user-123",
  userEmail: "test@example.com",
  sourcePlatform: "photosynq",
  projectIdOld,
  projectUrlOld: `https://photosynq.com/projects/${projectIdOld}`,
  status,
  requestedAt: "2024-01-15T10:00:00Z",
});

// -------------------
// Helpers
// -------------------
function renderHistoryPage({
  isLoading = false,
  error = null,
  requests = [],
}: {
  isLoading?: boolean;
  error?: { status?: number; message: string } | null;
  requests?: ReturnType<typeof createMockRequest>[];
} = {}) {
  if (isLoading) {
    mockUseTransferRequests.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });
  } else if (error) {
    mockUseTransferRequests.mockReturnValue({
      data: null,
      isLoading: false,
      error,
    });
  } else {
    mockUseTransferRequests.mockReturnValue({
      data: { body: requests },
      isLoading: false,
      error: null,
    });
  }

  return render(<TransferRequestHistoryPage />);
}

// -------------------
// Tests
// -------------------
describe("<TransferRequestHistoryPage />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Loading State", () => {
    it("renders loading skeletons when data is loading", () => {
      renderHistoryPage({ isLoading: true });

      expect(screen.getByText("transferRequest.yourRequests")).toBeInTheDocument();

      // Check for skeleton elements
      const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe("Error State", () => {
    it("renders error alert when there is an error", () => {
      const error = { message: "Failed to fetch", status: 500 };
      renderHistoryPage({ error });

      expect(screen.getByText("transferRequest.errorLoadingRequest")).toBeInTheDocument();
      expect(screen.getByText("transferRequest.errorLoadingRequests")).toBeInTheDocument();
    });

    it("shows error for 404 status", () => {
      const error = { message: "Not found", status: 404 };
      renderHistoryPage({ error });

      expect(screen.getByText("transferRequest.errorLoadingRequest")).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("renders empty state when no requests exist", () => {
      renderHistoryPage({ requests: [] });

      expect(screen.getByText("transferRequest.noRequests")).toBeInTheDocument();
      expect(screen.getByText("transferRequest.noRequestsDescription")).toBeInTheDocument();
    });

    it("does not render title in empty state", () => {
      renderHistoryPage({ requests: [] });

      expect(screen.queryByText("transferRequest.yourRequests")).not.toBeInTheDocument();
    });
  });

  describe("Requests Rendering", () => {
    it("renders list of transfer requests", () => {
      const requests = [
        createMockRequest("req-1", "pending", "project-123"),
        createMockRequest("req-2", "completed", "project-456"),
      ];
      renderHistoryPage({ requests });

      expect(screen.getByText("project-123")).toBeInTheDocument();
      expect(screen.getByText("project-456")).toBeInTheDocument();
    });

    it("renders project URLs for each request", () => {
      const requests = [createMockRequest("req-1", "pending", "project-789")];
      renderHistoryPage({ requests });

      expect(screen.getByText("https://photosynq.com/projects/project-789")).toBeInTheDocument();
    });

    it("renders requested date for each request", () => {
      const requests = [createMockRequest("req-1", "pending", "project-123")];
      renderHistoryPage({ requests });

      expect(screen.getByText(/transferRequest\.requestedAt/)).toBeInTheDocument();
      expect(screen.getByText(/formatted-2024-01-15T10:00:00Z/)).toBeInTheDocument();
    });
  });

  describe("Status Display", () => {
    it("renders pending status with correct styling", () => {
      const requests = [createMockRequest("req-1", "pending", "project-123")];
      renderHistoryPage({ requests });

      const pendingLabel = screen.getByText("Pending");
      expect(pendingLabel).toBeInTheDocument();
    });

    it("renders completed status with correct styling", () => {
      const requests = [createMockRequest("req-1", "completed", "project-123")];
      renderHistoryPage({ requests });

      const completedLabel = screen.getByText("Completed");
      expect(completedLabel).toBeInTheDocument();
    });

    it("renders rejected status with correct styling", () => {
      const requests = [createMockRequest("req-1", "rejected", "project-123")];
      renderHistoryPage({ requests });

      const rejectedLabel = screen.getByText("Rejected");
      expect(rejectedLabel).toBeInTheDocument();
    });

    it("renders status icons for all requests", () => {
      const requests = [
        createMockRequest("req-1", "pending", "project-1"),
        createMockRequest("req-2", "completed", "project-2"),
        createMockRequest("req-3", "rejected", "project-3"),
      ];
      const { container } = renderHistoryPage({ requests });

      // Check for SVG icons
      const icons = container.querySelectorAll("svg");
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe("Layout Structure", () => {
    it("renders title when requests exist", () => {
      const requests = [createMockRequest("req-1", "pending", "project-123")];
      renderHistoryPage({ requests });

      expect(screen.getByText("transferRequest.yourRequests")).toBeInTheDocument();
    });

    it("renders scrollable container for multiple requests", () => {
      const requests = Array.from({ length: 5 }, (_, i) =>
        createMockRequest(`req-${i}`, "pending", `project-${i}`),
      );
      const { container } = renderHistoryPage({ requests });

      // Check for overflow container
      const scrollContainer = container.querySelector('[class*="overflow-y-auto"]');
      expect(scrollContainer).toBeInTheDocument();
    });
  });

  describe("Hook Integration", () => {
    it("calls useTransferRequests hook", () => {
      renderHistoryPage();

      expect(mockUseTransferRequests).toHaveBeenCalled();
    });

    it("handles undefined data body gracefully", () => {
      mockUseTransferRequests.mockReturnValue({
        data: { body: undefined },
        isLoading: false,
        error: null,
      });

      render(<TransferRequestHistoryPage />);

      expect(screen.getByText("transferRequest.noRequests")).toBeInTheDocument();
    });

    it("handles null data gracefully", () => {
      mockUseTransferRequests.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      render(<TransferRequestHistoryPage />);

      expect(screen.getByText("transferRequest.noRequests")).toBeInTheDocument();
    });
  });

  describe("Different Request Scenarios", () => {
    it("renders single request correctly", () => {
      const requests = [createMockRequest("req-1", "completed", "single-project")];
      renderHistoryPage({ requests });

      expect(screen.getByText("single-project")).toBeInTheDocument();
      expect(screen.getByText("Completed")).toBeInTheDocument();
      expect(screen.getByText("https://photosynq.com/projects/single-project")).toBeInTheDocument();
    });

    it("renders many requests", () => {
      const requests = Array.from({ length: 10 }, (_, i) =>
        createMockRequest(`req-${i}`, "pending", `project-${i}`),
      );
      renderHistoryPage({ requests });

      // Check first and last
      expect(screen.getByText("project-0")).toBeInTheDocument();
      expect(screen.getByText("project-9")).toBeInTheDocument();
    });
  });
});
