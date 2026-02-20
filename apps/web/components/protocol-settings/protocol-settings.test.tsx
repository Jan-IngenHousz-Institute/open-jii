import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ProtocolSettings } from "./protocol-settings";

// Hoisted mocks
const useProtocolMock = vi.hoisted(() => vi.fn());

// Mock useProtocol hook
vi.mock("../../hooks/protocol/useProtocol/useProtocol", () => ({
  useProtocol: useProtocolMock,
}));

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock child components to isolate ProtocolSettings logic
vi.mock("./protocol-details-card", () => ({
  ProtocolDetailsCard: (props: Record<string, unknown>) => (
    <div data-testid="protocol-details-card" data-protocol-id={props.protocolId}>
      ProtocolDetailsCard
    </div>
  ),
}));

vi.mock("./protocol-info-card", () => ({
  ProtocolInfoCard: (props: Record<string, unknown>) => (
    <div data-testid="protocol-info-card" data-protocol-id={props.protocolId}>
      ProtocolInfoCard
    </div>
  ),
}));

describe("ProtocolSettings", () => {
  const mockProtocol = {
    id: "protocol-123",
    name: "Test Protocol",
    description: "A test description",
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
    useProtocolMock.mockReturnValue({
      data: { body: mockProtocol },
      isLoading: false,
    });
  });

  it("should show loading state while fetching protocol", () => {
    useProtocolMock.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    render(<ProtocolSettings protocolId="protocol-123" />);

    expect(screen.getByText("protocolSettings.loading")).toBeInTheDocument();
    expect(screen.queryByTestId("protocol-details-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("protocol-info-card")).not.toBeInTheDocument();
  });

  it("should show not found state when data is missing", () => {
    useProtocolMock.mockReturnValue({
      data: undefined,
      isLoading: false,
    });

    render(<ProtocolSettings protocolId="protocol-123" />);

    expect(screen.getByText("protocolSettings.notFound")).toBeInTheDocument();
    expect(screen.queryByTestId("protocol-details-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("protocol-info-card")).not.toBeInTheDocument();
  });

  it("should render both child cards when data is loaded", () => {
    render(<ProtocolSettings protocolId="protocol-123" />);

    expect(screen.getByTestId("protocol-details-card")).toBeInTheDocument();
    expect(screen.getByTestId("protocol-info-card")).toBeInTheDocument();
  });

  it("should pass protocol id to useProtocol hook", () => {
    render(<ProtocolSettings protocolId="protocol-123" />);

    expect(useProtocolMock).toHaveBeenCalledWith("protocol-123");
  });

  it("should pass correct props to ProtocolDetailsCard", () => {
    render(<ProtocolSettings protocolId="protocol-123" />);

    const detailsCard = screen.getByTestId("protocol-details-card");
    expect(detailsCard).toHaveAttribute("data-protocol-id", "protocol-123");
  });

  it("should pass correct props to ProtocolInfoCard", () => {
    render(<ProtocolSettings protocolId="protocol-123" />);

    const infoCard = screen.getByTestId("protocol-info-card");
    expect(infoCard).toHaveAttribute("data-protocol-id", "protocol-123");
  });

  it("should use empty string for null description", () => {
    useProtocolMock.mockReturnValue({
      data: { body: { ...mockProtocol, description: null } },
      isLoading: false,
    });

    render(<ProtocolSettings protocolId="protocol-123" />);

    // Component should still render without error
    expect(screen.getByTestId("protocol-details-card")).toBeInTheDocument();
  });
});
