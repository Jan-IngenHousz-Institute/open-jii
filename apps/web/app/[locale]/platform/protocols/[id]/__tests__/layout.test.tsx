import { createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { notFound, useParams } from "next/navigation";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { contract } from "@repo/api";
import { useSession } from "@repo/auth/client";

import ProtocolLayout from "../layout";

vi.mock("@/components/error-display", () => ({
  ErrorDisplay: ({ error }: { error: unknown }) => (
    <div data-testid="error-display">{String(error)}</div>
  ),
}));

function mountProtocol(overrides: Parameters<typeof createProtocol>[0] = {}) {
  const protocol = createProtocol({ id: "test-id", ...overrides });
  server.mount(contract.protocols.getProtocol, { body: protocol });
  return protocol;
}

function mockSessionUser(userId: string) {
  vi.mocked(useSession).mockReturnValue({
    data: {
      user: { id: userId, email: "test@example.com", name: "Test", registered: true },
      expires: "2099-01-01",
    },
    status: "authenticated",
    update: vi.fn(),
  } as never);
}

describe("ProtocolLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useParams).mockReturnValue({ id: "test-id", locale: "en-US" });
  });

  describe("Loading State", () => {
    it("should display loading message when data is loading", () => {
      server.mount(contract.protocols.getProtocol, { body: createProtocol(), delay: 999_999 });

      render(
        <ProtocolLayout>
          <div>Children</div>
        </ProtocolLayout>,
      );

      expect(screen.getByText("protocols.loadingProtocols")).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("should call notFound for 404 errors", async () => {
      server.mount(contract.protocols.getProtocol, { status: 404 });

      render(
        <ProtocolLayout>
          <div>Children</div>
        </ProtocolLayout>,
      );

      await waitFor(() => {
        expect(vi.mocked(notFound)).toHaveBeenCalled();
      });
    });

    it("should call notFound for 400 errors (invalid UUID)", async () => {
      server.mount(contract.protocols.getProtocol, { status: 400 });

      render(
        <ProtocolLayout>
          <div>Children</div>
        </ProtocolLayout>,
      );

      await waitFor(() => {
        expect(vi.mocked(notFound)).toHaveBeenCalled();
      });
    });

    it("should display error for other error types", async () => {
      server.mount(contract.protocols.getProtocol, { status: 500 });

      render(
        <ProtocolLayout>
          <div>Children</div>
        </ProtocolLayout>,
      );

      await waitFor(() => {
        expect(screen.getByText("errors.error")).toBeInTheDocument();
      });
      expect(screen.getByText("protocols.notFoundDescription")).toBeInTheDocument();
      expect(screen.getByTestId("error-display")).toBeInTheDocument();
      expect(vi.mocked(notFound)).not.toHaveBeenCalled();
    });
  });

  describe("Success State", () => {
    it("should render protocol layout with overview tab", async () => {
      mountProtocol({ createdBy: "other-user" });
      mockSessionUser("user-123");

      render(
        <ProtocolLayout>
          <div>Children Content</div>
        </ProtocolLayout>,
      );

      await waitFor(() => {
        expect(screen.getByText("protocols.protocol")).toBeInTheDocument();
      });
      expect(screen.getByText("protocols.manageProtocolDescription")).toBeInTheDocument();
      expect(screen.getByText("protocols.overview")).toBeInTheDocument();
      expect(screen.getByText("Children Content")).toBeInTheDocument();
    });

    it("should show settings tab when user is the creator", async () => {
      mountProtocol({ createdBy: "user-123" });
      mockSessionUser("user-123");

      render(
        <ProtocolLayout>
          <div>Children</div>
        </ProtocolLayout>,
      );

      await waitFor(() => {
        expect(screen.getByText("navigation.settings")).toBeInTheDocument();
      });
    });

    it("should not show settings tab when user is not the creator", async () => {
      mountProtocol({ createdBy: "different-user" });
      mockSessionUser("user-123");

      render(
        <ProtocolLayout>
          <div>Children</div>
        </ProtocolLayout>,
      );

      await waitFor(() => {
        expect(screen.getByText("protocols.overview")).toBeInTheDocument();
      });
      expect(screen.queryByText("navigation.settings")).not.toBeInTheDocument();
    });
  });
});
