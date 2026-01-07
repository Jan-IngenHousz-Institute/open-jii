import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import ProtocolLayout from "../layout";

// Mock return type for useProtocol
interface MockProtocolReturn {
  data: { body: { id: string; name: string; createdBy: string } } | undefined;
  isLoading: boolean;
  error: { status?: number; message?: string } | null;
}

// Mock the useProtocol hook
const mockUseProtocol = vi.fn<() => MockProtocolReturn>();
vi.mock("@/hooks/protocol/useProtocol/useProtocol", () => ({
  useProtocol: (): MockProtocolReturn => mockUseProtocol(),
}));

// Mock useLocale hook
vi.mock("@/hooks/useLocale", () => ({
  useLocale: () => "en-US" as string,
}));

// Mock next/navigation
const mockNotFound = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/en-US/platform/protocols/test-id" as string,
  useParams: () => ({ id: "test-id" }) as { id: string },
  notFound: () => mockNotFound() as never,
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    locale,
  }: {
    children: React.ReactNode;
    href: string;
    locale?: string;
  }) => (
    <a href={href} data-locale={locale} data-testid="link">
      {children}
    </a>
  ),
}));

// Mock useSession from @repo/auth/client
vi.mock("@repo/auth/client", () => ({
  useSession: () => ({
    data: { user: { id: "user-123" } },
  }),
}));

// Mock ErrorDisplay component
vi.mock("@/components/error-display", () => ({
  ErrorDisplay: ({ error }: { error: unknown }) => (
    <div data-testid="error-display">{String(error)}</div>
  ),
}));

describe("ProtocolLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotFound.mockClear();
  });

  describe("Loading State", () => {
    it("should display loading message when data is loading", () => {
      mockUseProtocol.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      render(
        <ProtocolLayout>
          <div>Children</div>
        </ProtocolLayout>,
      );

      expect(screen.getByText("protocols.loadingProtocols")).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("should call notFound for 404 errors", () => {
      const error = { status: 404, message: "Not found" };
      mockUseProtocol.mockReturnValue({
        data: undefined,
        isLoading: false,
        error,
      });

      render(
        <ProtocolLayout>
          <div>Children</div>
        </ProtocolLayout>,
      );

      expect(mockNotFound).toHaveBeenCalled();
    });

    it("should call notFound for 400 errors (invalid UUID)", () => {
      const error = { status: 400, message: "Invalid UUID" };
      mockUseProtocol.mockReturnValue({
        data: undefined,
        isLoading: false,
        error,
      });

      render(
        <ProtocolLayout>
          <div>Children</div>
        </ProtocolLayout>,
      );

      expect(mockNotFound).toHaveBeenCalled();
    });

    it("should display error for other error types", () => {
      const error = { status: 500, message: "Server error" };
      mockUseProtocol.mockReturnValue({
        data: undefined,
        isLoading: false,
        error,
      });

      render(
        <ProtocolLayout>
          <div>Children</div>
        </ProtocolLayout>,
      );

      expect(screen.getByText("errors.error")).toBeInTheDocument();
      expect(screen.getByText("protocols.notFoundDescription")).toBeInTheDocument();
      expect(screen.getByTestId("error-display")).toBeInTheDocument();
      expect(mockNotFound).not.toHaveBeenCalled();
    });
  });

  describe("Success State", () => {
    it("should render protocol layout with overview tab", () => {
      mockUseProtocol.mockReturnValue({
        data: {
          body: {
            id: "test-id",
            name: "Test Protocol",
            createdBy: "other-user",
          },
        },
        isLoading: false,
        error: null,
      });

      render(
        <ProtocolLayout>
          <div>Children Content</div>
        </ProtocolLayout>,
      );

      expect(screen.getByText("protocols.protocol")).toBeInTheDocument();
      expect(screen.getByText("protocols.manageProtocolDescription")).toBeInTheDocument();
      expect(screen.getByText("protocols.overview")).toBeInTheDocument();
      expect(screen.getByText("Children Content")).toBeInTheDocument();
    });

    it("should show settings tab when user is the creator", () => {
      mockUseProtocol.mockReturnValue({
        data: {
          body: {
            id: "test-id",
            name: "Test Protocol",
            createdBy: "user-123", // Same as mocked session user
          },
        },
        isLoading: false,
        error: null,
      });

      render(
        <ProtocolLayout>
          <div>Children</div>
        </ProtocolLayout>,
      );

      expect(screen.getByText("navigation.settings")).toBeInTheDocument();
    });

    it("should not show settings tab when user is not the creator", () => {
      mockUseProtocol.mockReturnValue({
        data: {
          body: {
            id: "test-id",
            name: "Test Protocol",
            createdBy: "different-user",
          },
        },
        isLoading: false,
        error: null,
      });

      render(
        <ProtocolLayout>
          <div>Children</div>
        </ProtocolLayout>,
      );

      expect(screen.queryByText("navigation.settings")).not.toBeInTheDocument();
    });
  });
});
