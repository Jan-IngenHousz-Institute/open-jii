import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ExperimentLinkedProtocols } from "./experiment-linked-protocols";

// ---------- Mocks ----------
const useExperimentFlowMock = vi.hoisted(() => vi.fn());
const useProtocolMock = vi.hoisted(() => vi.fn());

vi.mock("../../../hooks/experiment/useExperimentFlow/useExperimentFlow", () => ({
  useExperimentFlow: useExperimentFlowMock,
}));

vi.mock("../../../hooks/protocol/useProtocol/useProtocol", () => ({
  useProtocol: useProtocolMock,
}));

vi.mock("./protocol-card", () => ({
  ProtocolCard: ({ protocol, isLoading }: { protocol?: { name: string }; isLoading: boolean }) => (
    <div data-testid="protocol-card">
      {isLoading ? "loading" : (protocol?.name ?? "no-protocol")}
    </div>
  ),
  ProtocolSelector: ({
    protocolIds,
    selectedProtocolId,
  }: {
    protocolIds: string[];
    selectedProtocolId: string;
  }) => (
    <div data-testid="protocol-selector">
      {protocolIds.join(",")}-{selectedProtocolId}
    </div>
  ),
}));

vi.mock("~/util/apiError", () => ({
  parseApiError: (error: unknown) => error,
}));

describe("ExperimentLinkedProtocols", () => {
  beforeEach(() => {
    useProtocolMock.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
  });

  it("renders loading state", () => {
    useExperimentFlowMock.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    render(<ExperimentLinkedProtocols experimentId="exp-123" />);
    expect(screen.getByText("protocols.linkedProtocols")).toBeInTheDocument();
    // Loading state renders a skeleton, not the protocol cards
    expect(screen.queryByTestId("protocol-card")).not.toBeInTheDocument();
  });

  it("renders no flow state", () => {
    useExperimentFlowMock.mockReturnValue({
      data: null,
      isLoading: false,
      error: { code: "NOT_FOUND" },
    });

    render(<ExperimentLinkedProtocols experimentId="exp-123" />);
    expect(screen.getByText("protocols.noFlowYet")).toBeInTheDocument();
    expect(screen.getByText("protocols.createFlow")).toBeInTheDocument();
  });

  it("renders error state", () => {
    useExperimentFlowMock.mockReturnValue({
      data: null,
      isLoading: false,
      error: { message: "Error loading flow" },
    });

    render(<ExperimentLinkedProtocols experimentId="exp-123" />);
    expect(screen.getByText("protocols.unableToLoadExperimentFlow")).toBeInTheDocument();
  });

  it("renders no protocols linked state", () => {
    useExperimentFlowMock.mockReturnValue({
      data: {
        body: {
          graph: {
            nodes: [],
            edges: [],
          },
        },
      },
      isLoading: false,
      error: null,
    });

    render(<ExperimentLinkedProtocols experimentId="exp-123" />);
    expect(screen.getByText("protocols.noProtocolsLinked")).toBeInTheDocument();
    expect(screen.getByText("protocols.goToFlow")).toBeInTheDocument();
  });

  it("renders protocol selector when protocols exist", () => {
    useExperimentFlowMock.mockReturnValue({
      data: {
        body: {
          graph: {
            nodes: [
              {
                id: "node-1",
                type: "measurement",
                content: { protocolId: "protocol-1" },
              },
              {
                id: "node-2",
                type: "measurement",
                content: { protocolId: "protocol-2" },
              },
            ],
            edges: [],
          },
        },
      },
      isLoading: false,
      error: null,
    });

    useProtocolMock.mockReturnValue({
      data: { body: { name: "Protocol 1" } },
      isLoading: false,
      error: null,
    });

    render(<ExperimentLinkedProtocols experimentId="exp-123" />);
    expect(screen.getByTestId("protocol-selector")).toHaveTextContent("protocol-1,protocol-2");
    expect(screen.getByTestId("protocol-card")).toBeInTheDocument();
  });

  it("renders protocol card with protocol data", () => {
    useExperimentFlowMock.mockReturnValue({
      data: {
        body: {
          graph: {
            nodes: [
              {
                id: "node-1",
                type: "measurement",
                content: { protocolId: "protocol-1" },
              },
            ],
            edges: [],
          },
        },
      },
      isLoading: false,
      error: null,
    });

    useProtocolMock.mockReturnValue({
      data: { body: { name: "Test Protocol" } },
      isLoading: false,
      error: null,
    });

    render(<ExperimentLinkedProtocols experimentId="exp-123" />);
    expect(screen.getByTestId("protocol-card")).toHaveTextContent("Test Protocol");
  });

  it("shows protocol loading state", () => {
    useExperimentFlowMock.mockReturnValue({
      data: {
        body: {
          graph: {
            nodes: [
              {
                id: "node-1",
                type: "measurement",
                content: { protocolId: "protocol-1" },
              },
            ],
            edges: [],
          },
        },
      },
      isLoading: false,
      error: null,
    });

    useProtocolMock.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    render(<ExperimentLinkedProtocols experimentId="exp-123" />);
    expect(screen.getByTestId("protocol-card")).toHaveTextContent("loading");
  });

  it("renders go to protocol link when protocol is selected", () => {
    useExperimentFlowMock.mockReturnValue({
      data: {
        body: {
          graph: {
            nodes: [
              {
                id: "node-1",
                type: "measurement",
                content: { protocolId: "protocol-1" },
              },
            ],
            edges: [],
          },
        },
      },
      isLoading: false,
      error: null,
    });

    useProtocolMock.mockReturnValue({
      data: { body: { name: "Test Protocol" } },
      isLoading: false,
      error: null,
    });

    render(<ExperimentLinkedProtocols experimentId="exp-123" />);
    expect(screen.getByText("protocols.goToProtocol")).toBeInTheDocument();
  });

  it("filters duplicate protocol IDs", () => {
    useExperimentFlowMock.mockReturnValue({
      data: {
        body: {
          graph: {
            nodes: [
              {
                id: "node-1",
                type: "measurement",
                content: { protocolId: "protocol-1" },
              },
              {
                id: "node-2",
                type: "measurement",
                content: { protocolId: "protocol-1" },
              },
              {
                id: "node-3",
                type: "measurement",
                content: { protocolId: "protocol-2" },
              },
            ],
            edges: [],
          },
        },
      },
      isLoading: false,
      error: null,
    });

    useProtocolMock.mockReturnValue({
      data: { body: { name: "Protocol 1" } },
      isLoading: false,
      error: null,
    });

    render(<ExperimentLinkedProtocols experimentId="exp-123" />);
    expect(screen.getByTestId("protocol-selector")).toHaveTextContent("protocol-1,protocol-2");
  });
});
