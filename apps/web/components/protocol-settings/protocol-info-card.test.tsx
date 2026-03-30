import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { ProtocolInfoCard } from "./protocol-info-card";

// Mock the delete mutation function
const mockDeleteMutate = vi.fn().mockImplementation(() => Promise.resolve());

// Mock useProtocolDelete
vi.mock("@/hooks/protocol/useProtocolDelete/useProtocolDelete", () => ({
  useProtocolDelete: () => ({
    mutateAsync: mockDeleteMutate,
    isPending: false,
  }),
}));

// Set up mocks before tests
const mockPush = vi.fn();

// Mock useTranslation
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (k: string, options?: Record<string, unknown>) => {
      if (options) {
        return `${k} ${JSON.stringify(options)}`;
      }
      return k;
    },
  }),
}));

// Mock useLocale
vi.mock("@/hooks/useLocale", () => ({
  useLocale: () => "en",
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock formatDate
vi.mock("@/util/date", () => ({
  formatDate: (dateString: string) => `formatted-${dateString}`,
}));

// PostHog feature flags - hoisted mock
const useFeatureFlagEnabledMock = vi.hoisted(() => vi.fn());

vi.mock("posthog-js/react", () => ({
  useFeatureFlagEnabled: useFeatureFlagEnabledMock,
}));

describe("ProtocolInfoCard", () => {
  const mockProtocol = {
    id: "protocol-123",
    name: "Test Protocol",
    description: "Test description",
    code: [{ averages: 1 }],
    family: "generic" as const,
    sortOrder: null,
    createdBy: "user-123",
    createdByName: "Test User",
    createdAt: "2023-01-01T00:00:00Z",
    updatedAt: "2023-01-02T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
    mockDeleteMutate.mockClear();

    // Default: feature flag enabled
    useFeatureFlagEnabledMock.mockReturnValue(true);
  });

  it("should render the protocol info card with correct data", () => {
    render(<ProtocolInfoCard protocolId="protocol-123" protocol={mockProtocol} />);

    // Check titles
    expect(screen.getByText("protocolSettings.protocolInfo")).toBeInTheDocument();
    expect(screen.getByText("protocolSettings.protocolInfoDescription")).toBeInTheDocument();

    // Check creation and update dates
    expect(screen.getByText("protocolSettings.created:")).toBeInTheDocument();
    expect(screen.getByText(/formatted-2023-01-01T00:00:00Z/)).toBeInTheDocument();
    expect(screen.getByText("protocolSettings.updated:")).toBeInTheDocument();
    expect(screen.getByText(/formatted-2023-01-02T00:00:00Z/)).toBeInTheDocument();

    // Check ID
    expect(screen.getByText("protocols.protocolId:")).toBeInTheDocument();
    expect(screen.getByText("protocol-123")).toBeInTheDocument();
  });

  it("should render the danger zone section when feature flag is enabled", () => {
    useFeatureFlagEnabledMock.mockReturnValue(true);

    render(<ProtocolInfoCard protocolId="protocol-123" protocol={mockProtocol} />);

    expect(screen.getByText("protocolSettings.dangerZone")).toBeInTheDocument();
    expect(screen.getByText("protocolSettings.deleteWarning")).toBeInTheDocument();
    expect(screen.getByText("protocolSettings.deleteProtocol")).toBeInTheDocument();
  });

  it("should not render delete button when feature flag is disabled", () => {
    useFeatureFlagEnabledMock.mockReturnValue(false);

    render(<ProtocolInfoCard protocolId="protocol-123" protocol={mockProtocol} />);

    expect(screen.queryByText("protocolSettings.dangerZone")).not.toBeInTheDocument();
    expect(screen.queryByText("protocolSettings.deleteProtocol")).not.toBeInTheDocument();
  });

  it("should open the delete confirmation dialog when delete button is clicked", () => {
    render(<ProtocolInfoCard protocolId="protocol-123" protocol={mockProtocol} />);

    const deleteButton = screen.getByText("protocolSettings.deleteProtocol");
    fireEvent.click(deleteButton);

    // The dialog text is broken up into multiple elements, so we use a more flexible approach
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent(
      `common.confirmDelete ${JSON.stringify({ name: "Test Protocol" })}`,
    );
    expect(screen.getByText("protocolSettings.cancel")).toBeInTheDocument();
    expect(screen.getByText("protocolSettings.delete")).toBeInTheDocument();
  });

  it("should close the dialog when cancel is clicked", () => {
    render(<ProtocolInfoCard protocolId="protocol-123" protocol={mockProtocol} />);

    // Open the dialog
    const deleteButton = screen.getByText("protocolSettings.deleteProtocol");
    fireEvent.click(deleteButton);

    // Check that the dialog is open
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent(
      `common.confirmDelete ${JSON.stringify({ name: "Test Protocol" })}`,
    );

    // Click cancel
    const cancelButton = screen.getByText("protocolSettings.cancel");
    fireEvent.click(cancelButton);

    // Dialog should be closed
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("should handle delete when confirmed", async () => {
    render(<ProtocolInfoCard protocolId="protocol-123" protocol={mockProtocol} />);

    // Open the dialog
    const deleteButton = screen.getByText("protocolSettings.deleteProtocol");
    fireEvent.click(deleteButton);

    // Click delete
    const confirmDeleteButton = screen.getByText("protocolSettings.delete");
    fireEvent.click(confirmDeleteButton);

    // Wait for the async operation to complete
    await waitFor(() => {
      expect(mockDeleteMutate).toHaveBeenCalledWith({ params: { id: "protocol-123" } });
      expect(mockPush).toHaveBeenCalledWith("/en/platform/protocols");
    });
  });
});
