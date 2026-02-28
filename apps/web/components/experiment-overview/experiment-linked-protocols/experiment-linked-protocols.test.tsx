import { createFlow, createFlowNode, createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api";

import { ExperimentLinkedProtocols } from "./experiment-linked-protocols";

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

const PROTO_UUID_1 = "00000000-0000-4000-8000-000000000010";
const PROTO_UUID_2 = "00000000-0000-4000-8000-000000000020";

function mountFlow(protocolIds: string[]) {
  const nodes = protocolIds.map((protocolId, i) =>
    createFlowNode({ type: "measurement", content: { protocolId }, isStart: i === 0 }),
  );
  if (nodes.length === 0) {
    nodes.push(createFlowNode({ type: "instruction", content: { text: "Begin" }, isStart: true }));
  }
  return server.mount(contract.experiments.getFlow, {
    body: createFlow({ graph: { nodes, edges: [] } }),
  });
}

function mountProtocol(name = "Test Protocol") {
  return server.mount(contract.protocols.getProtocol, {
    body: createProtocol({ name }),
  });
}

describe("ExperimentLinkedProtocols", () => {
  it("renders loading state", () => {
    server.mount(contract.experiments.getFlow, {
      body: createFlow({
        graph: {
          nodes: [
            createFlowNode({
              type: "measurement",
              content: { protocolId: PROTO_UUID_1 },
              isStart: true,
            }),
          ],
          edges: [],
        },
      }),
      delay: 5000,
    });

    render(<ExperimentLinkedProtocols experimentId="exp-123" />);

    expect(screen.getByText("protocols.linkedProtocols")).toBeInTheDocument();
    expect(screen.queryByTestId("protocol-card")).not.toBeInTheDocument();
  });

  it("renders no flow state when 404", async () => {
    server.mount(contract.experiments.getFlow, {
      status: 404,
      body: { message: "Not found", code: "NOT_FOUND" },
    });

    render(<ExperimentLinkedProtocols experimentId="exp-123" />);

    await waitFor(() => {
      expect(screen.getByText("protocols.noFlowYet")).toBeInTheDocument();
    });
    expect(screen.getByText("protocols.createFlow")).toBeInTheDocument();
  });

  it("renders error state for non-404 errors", async () => {
    server.mount(contract.experiments.getFlow, { status: 500 });

    render(<ExperimentLinkedProtocols experimentId="exp-123" />);

    await waitFor(() => {
      expect(screen.getByText("protocols.unableToLoadExperimentFlow")).toBeInTheDocument();
    });
  });

  it("renders no protocols linked when flow has no measurement nodes", async () => {
    // Flow exists but has no measurement nodes → protocolIds is empty
    mountFlow([]);

    render(<ExperimentLinkedProtocols experimentId="exp-123" />);

    await waitFor(() => {
      expect(screen.getByText("protocols.noProtocolsLinked")).toBeInTheDocument();
    });
    expect(screen.getByText("protocols.goToFlow")).toBeInTheDocument();
  });

  it("renders protocol selector when protocols exist", async () => {
    mountFlow([PROTO_UUID_1, PROTO_UUID_2]);
    mountProtocol("Protocol 1");

    render(<ExperimentLinkedProtocols experimentId="exp-123" />);

    await waitFor(() => {
      expect(screen.getByTestId("protocol-selector")).toHaveTextContent(
        `${PROTO_UUID_1},${PROTO_UUID_2}`,
      );
    });
    expect(screen.getByTestId("protocol-card")).toBeInTheDocument();
  });

  it("renders protocol card with protocol data", async () => {
    mountFlow([PROTO_UUID_1]);
    mountProtocol("Test Protocol");

    render(<ExperimentLinkedProtocols experimentId="exp-123" />);

    await waitFor(() => {
      expect(screen.getByTestId("protocol-card")).toHaveTextContent("Test Protocol");
    });
  });

  it("shows protocol loading state", async () => {
    mountFlow([PROTO_UUID_1]);
    server.mount(contract.protocols.getProtocol, {
      body: createProtocol({ name: "Slow Protocol" }),
      delay: 5000,
    });

    render(<ExperimentLinkedProtocols experimentId="exp-123" />);

    await waitFor(() => {
      expect(screen.getByTestId("protocol-card")).toHaveTextContent("loading");
    });
  });

  it("renders go to protocol link when protocol is selected", async () => {
    mountFlow([PROTO_UUID_1]);
    mountProtocol();

    render(<ExperimentLinkedProtocols experimentId="exp-123" />);

    await waitFor(() => {
      expect(screen.getByText("protocols.goToProtocol")).toBeInTheDocument();
    });
  });

  it("filters duplicate protocol IDs", async () => {
    mountFlow([PROTO_UUID_1, PROTO_UUID_1, PROTO_UUID_2]);
    mountProtocol("Protocol 1");

    render(<ExperimentLinkedProtocols experimentId="exp-123" />);

    await waitFor(() => {
      expect(screen.getByTestId("protocol-selector")).toHaveTextContent(
        `${PROTO_UUID_1},${PROTO_UUID_2}`,
      );
    });
  });
});
