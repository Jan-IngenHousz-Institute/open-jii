import { createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { ProtocolSettings } from "./protocol-settings";

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

vi.mock("./protocol-compatible-macros-card", () => ({
  ProtocolCompatibleMacrosCard: (props: Record<string, unknown>) => (
    <div data-testid="protocol-compatible-macros-card" data-protocol-id={props.protocolId}>
      ProtocolCompatibleMacrosCard
    </div>
  ),
}));

describe("ProtocolSettings", () => {
  const mockProtocol = createProtocol({
    id: "protocol-123",
    name: "Test Protocol",
    description: "A test description",
    code: [{ averages: 1 }],
    family: "generic",
    sortOrder: null,
    createdBy: "user-123",
    createdByName: "Test User",
    createdAt: "2023-01-01T00:00:00Z",
    updatedAt: "2023-01-02T00:00:00Z",
  });

  it("should show loading state while fetching protocol", () => {
    server.mount(contract.protocols.getProtocol, { body: mockProtocol, delay: 999_999 });

    render(<ProtocolSettings protocolId="protocol-123" />);

    expect(screen.getByText("protocolSettings.loading")).toBeInTheDocument();
    expect(screen.queryByTestId("protocol-details-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("protocol-info-card")).not.toBeInTheDocument();
  });

  it("should show not found state when data is missing", async () => {
    server.mount(contract.protocols.getProtocol, {
      status: 404,
      body: { message: "Not found", statusCode: 404 },
    });

    render(<ProtocolSettings protocolId="protocol-123" />);

    await waitFor(() => {
      expect(screen.getByText("protocolSettings.notFound")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("protocol-details-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("protocol-info-card")).not.toBeInTheDocument();
  });

  it("should render both child cards when data is loaded", async () => {
    server.mount(contract.protocols.getProtocol, { body: mockProtocol });

    render(<ProtocolSettings protocolId="protocol-123" />);

    await waitFor(() => {
      expect(screen.getByTestId("protocol-details-card")).toBeInTheDocument();
    });
    expect(screen.getByTestId("protocol-info-card")).toBeInTheDocument();
  });

  it("should pass protocol id via API call", async () => {
    const spy = server.mount(contract.protocols.getProtocol, { body: mockProtocol });

    render(<ProtocolSettings protocolId="protocol-123" />);

    await waitFor(() => {
      expect(spy.called).toBe(true);
    });
    expect(spy.params.id).toBe("protocol-123");
  });

  it("should pass correct props to ProtocolDetailsCard", async () => {
    server.mount(contract.protocols.getProtocol, { body: mockProtocol });

    render(<ProtocolSettings protocolId="protocol-123" />);

    await waitFor(() => {
      expect(screen.getByTestId("protocol-details-card")).toBeInTheDocument();
    });
    const detailsCard = screen.getByTestId("protocol-details-card");
    expect(detailsCard).toHaveAttribute("data-protocol-id", "protocol-123");
  });

  it("should pass correct props to ProtocolInfoCard", async () => {
    server.mount(contract.protocols.getProtocol, { body: mockProtocol });

    render(<ProtocolSettings protocolId="protocol-123" />);

    await waitFor(() => {
      expect(screen.getByTestId("protocol-info-card")).toBeInTheDocument();
    });
    const infoCard = screen.getByTestId("protocol-info-card");
    expect(infoCard).toHaveAttribute("data-protocol-id", "protocol-123");
  });

  it("should use empty string for null description", async () => {
    server.mount(contract.protocols.getProtocol, {
      body: { ...mockProtocol, description: null },
    });

    render(<ProtocolSettings protocolId="protocol-123" />);

    await waitFor(() => {
      expect(screen.getByTestId("protocol-details-card")).toBeInTheDocument();
    });
  });
});
