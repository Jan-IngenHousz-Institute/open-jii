import { createTransferRequest } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { TransferRequestStatus } from "@repo/api";
import { contract } from "@repo/api";

import TransferRequestHistoryPage from "./page";

vi.mock("~/util/date", () => ({
  formatDate: (date: string) => `formatted-${date}`,
}));

const createRequest = (requestId: string, status: TransferRequestStatus, projectIdOld: string) =>
  createTransferRequest({
    requestId,
    status,
    projectIdOld,
    projectUrlOld: `https://photosynq.com/projects/${projectIdOld}`,
    requestedAt: "2024-01-15T10:00:00Z",
  });
describe("<TransferRequestHistoryPage />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Loading State", () => {
    it("renders loading skeletons when data is loading", () => {
      server.mount(contract.experiments.listTransferRequests, {
        body: [],
        delay: 999_999,
      });

      render(<TransferRequestHistoryPage />);

      expect(screen.getByText("transferRequest.yourRequests")).toBeInTheDocument();
      const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe("Error State", () => {
    it("renders error alert when there is an error", async () => {
      server.mount(contract.experiments.listTransferRequests, { status: 500 });

      render(<TransferRequestHistoryPage />);

      await waitFor(() => {
        expect(screen.getByText("transferRequest.errorLoadingRequest")).toBeInTheDocument();
        expect(screen.getByText("transferRequest.errorLoadingRequests")).toBeInTheDocument();
      });
    });

    it("shows error for 404 status", async () => {
      server.mount(contract.experiments.listTransferRequests, { status: 404 });

      render(<TransferRequestHistoryPage />);

      await waitFor(() => {
        expect(screen.getByText("transferRequest.errorLoadingRequest")).toBeInTheDocument();
      });
    });
  });

  describe("Empty State", () => {
    it("renders empty state when no requests exist", async () => {
      server.mount(contract.experiments.listTransferRequests, { body: [] });

      render(<TransferRequestHistoryPage />);

      await waitFor(() => {
        expect(screen.getByText("transferRequest.noRequests")).toBeInTheDocument();
        expect(screen.getByText("transferRequest.noRequestsDescription")).toBeInTheDocument();
      });
    });

    it("does not render title in empty state", async () => {
      server.mount(contract.experiments.listTransferRequests, { body: [] });

      render(<TransferRequestHistoryPage />);

      await waitFor(() => {
        expect(screen.getByText("transferRequest.noRequests")).toBeInTheDocument();
      });
      expect(screen.queryByText("transferRequest.yourRequests")).not.toBeInTheDocument();
    });
  });

  describe("Requests Rendering", () => {
    it("renders list of transfer requests", async () => {
      server.mount(contract.experiments.listTransferRequests, {
        body: [
          createRequest("req-1", "pending", "project-123"),
          createRequest("req-2", "completed", "project-456"),
        ],
      });

      render(<TransferRequestHistoryPage />);

      await waitFor(() => {
        expect(screen.getByText("project-123")).toBeInTheDocument();
        expect(screen.getByText("project-456")).toBeInTheDocument();
      });
    });

    it("renders project URLs for each request", async () => {
      server.mount(contract.experiments.listTransferRequests, {
        body: [createRequest("req-1", "pending", "project-789")],
      });

      render(<TransferRequestHistoryPage />);

      await waitFor(() => {
        expect(screen.getByText("https://photosynq.com/projects/project-789")).toBeInTheDocument();
      });
    });

    it("renders requested date for each request", async () => {
      server.mount(contract.experiments.listTransferRequests, {
        body: [createRequest("req-1", "pending", "project-123")],
      });

      render(<TransferRequestHistoryPage />);

      await waitFor(() => {
        expect(screen.getByText(/transferRequest\.requestedAt/)).toBeInTheDocument();
        expect(screen.getByText(/formatted-2024-01-15T10:00:00Z/)).toBeInTheDocument();
      });
    });
  });

  describe("Status Display", () => {
    it("renders pending status", async () => {
      server.mount(contract.experiments.listTransferRequests, {
        body: [createRequest("req-1", "pending", "project-123")],
      });

      render(<TransferRequestHistoryPage />);

      await waitFor(() => {
        expect(screen.getByText("Pending")).toBeInTheDocument();
      });
    });

    it("renders completed status", async () => {
      server.mount(contract.experiments.listTransferRequests, {
        body: [createRequest("req-1", "completed", "project-123")],
      });

      render(<TransferRequestHistoryPage />);

      await waitFor(() => {
        expect(screen.getByText("Completed")).toBeInTheDocument();
      });
    });

    it("renders rejected status", async () => {
      server.mount(contract.experiments.listTransferRequests, {
        body: [createRequest("req-1", "rejected", "project-123")],
      });

      render(<TransferRequestHistoryPage />);

      await waitFor(() => {
        expect(screen.getByText("Rejected")).toBeInTheDocument();
      });
    });
  });

  describe("Layout Structure", () => {
    it("renders title when requests exist", async () => {
      server.mount(contract.experiments.listTransferRequests, {
        body: [createRequest("req-1", "pending", "project-123")],
      });

      render(<TransferRequestHistoryPage />);

      await waitFor(() => {
        expect(screen.getByText("transferRequest.yourRequests")).toBeInTheDocument();
      });
    });

    it("renders scrollable container for multiple requests", async () => {
      server.mount(contract.experiments.listTransferRequests, {
        body: Array.from({ length: 5 }, (_, i) =>
          createRequest(`req-${i}`, "pending", `project-${i}`),
        ),
      });

      const { container } = render(<TransferRequestHistoryPage />);

      await waitFor(() => {
        const scrollContainer = container.querySelector('[class*="overflow-y-auto"]');
        expect(scrollContainer).toBeInTheDocument();
      });
    });
  });

  describe("Different Request Scenarios", () => {
    it("renders single request correctly", async () => {
      server.mount(contract.experiments.listTransferRequests, {
        body: [createRequest("req-1", "completed", "single-project")],
      });

      render(<TransferRequestHistoryPage />);

      await waitFor(() => {
        expect(screen.getByText("single-project")).toBeInTheDocument();
        expect(screen.getByText("Completed")).toBeInTheDocument();
        expect(
          screen.getByText("https://photosynq.com/projects/single-project"),
        ).toBeInTheDocument();
      });
    });

    it("renders many requests", async () => {
      server.mount(contract.experiments.listTransferRequests, {
        body: Array.from({ length: 10 }, (_, i) =>
          createRequest(`req-${i}`, "pending", `project-${i}`),
        ),
      });

      render(<TransferRequestHistoryPage />);

      await waitFor(() => {
        expect(screen.getByText("project-0")).toBeInTheDocument();
        expect(screen.getByText("project-9")).toBeInTheDocument();
      });
    });
  });
});
