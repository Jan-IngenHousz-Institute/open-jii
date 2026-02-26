import { createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api";

import { ProtocolCard, ProtocolSelector } from "./protocol-card";

// Pragmatic mock – Quill-backed RichTextRenderer has no jsdom support
vi.mock("@repo/ui/components", async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const actual = await importOriginal();
  return {
    ...actual,
    RichTextRenderer: ({ content }: { content: string }) => <span>{content}</span>,
  };
});

function mockOverflow({
  scrollHeight,
  clientHeight,
}: {
  scrollHeight: number;
  clientHeight: number;
}) {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    value: scrollHeight,
  });

  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    value: clientHeight,
  });
}

function mountProtocol(overrides = {}) {
  return server.mount(contract.protocols.getProtocol, {
    body: createProtocol(overrides),
  });
}

describe("ProtocolCard", () => {
  const protocol = createProtocol({
    description: "Test protocol description",
    family: "multispeq",
    createdByName: "Test User",
    updatedAt: "2023-01-15T00:00:00Z",
  });

  it("renders loading state", () => {
    render(<ProtocolCard protocol={undefined} isLoading={true} error={null} />);

    expect(screen.queryByText("protocols.unableToLoadProtocol")).not.toBeInTheDocument();
    expect(screen.queryByText("multispeq")).not.toBeInTheDocument();
  });

  it("renders error state", () => {
    render(<ProtocolCard protocol={undefined} isLoading={false} error={new Error("Failed")} />);

    expect(screen.getByText("protocols.unableToLoadProtocol")).toBeInTheDocument();
  });

  it("renders protocol metadata", () => {
    render(<ProtocolCard protocol={protocol} isLoading={false} error={null} />);

    expect(screen.getByText("multispeq")).toBeInTheDocument();
    expect(screen.getByText("Jan 15, 2023")).toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });

  it("renders protocol description", () => {
    render(<ProtocolCard protocol={protocol} isLoading={false} error={null} />);

    expect(screen.getByText("Test protocol description")).toBeInTheDocument();
  });

  it("does not render empty description", () => {
    const noDesc = createProtocol({ description: "<p><br></p>" });
    render(<ProtocolCard protocol={noDesc} isLoading={false} error={null} />);

    expect(screen.queryByText("form.description")).not.toBeInTheDocument();
  });

  it("shows fade gradient when description visually overflows", () => {
    mockOverflow({ scrollHeight: 500, clientHeight: 100 });

    render(<ProtocolCard protocol={protocol} isLoading={false} error={null} />);

    expect(document.querySelector(".bg-gradient-to-t")).toBeInTheDocument();
  });

  it("does not show fade gradient when description does not overflow", () => {
    mockOverflow({ scrollHeight: 100, clientHeight: 500 });

    render(<ProtocolCard protocol={protocol} isLoading={false} error={null} />);

    expect(document.querySelector(".bg-gradient-to-t")).not.toBeInTheDocument();
  });

  it("renders without creator name", () => {
    const noCreator = createProtocol({ createdByName: undefined });
    render(<ProtocolCard protocol={noCreator} isLoading={false} error={null} />);

    expect(screen.queryByText("Test User")).not.toBeInTheDocument();
  });
});

describe("ProtocolSelector", () => {
  it("renders selected protocol name from prop", () => {
    render(
      <ProtocolSelector
        protocolIds={["proto-1", "proto-2"]}
        selectedProtocolId="proto-1"
        selectedProtocolName="Selected Protocol"
        onProtocolChange={vi.fn()}
      />,
    );

    expect(screen.getAllByText("Selected Protocol").length).toBeGreaterThan(0);
  });

  it("shows loading text when no protocol name provided", () => {
    render(
      <ProtocolSelector
        protocolIds={["proto-1"]}
        selectedProtocolId="proto-1"
        onProtocolChange={vi.fn()}
      />,
    );

    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("calls onProtocolChange when selection changes", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    mountProtocol();

    render(
      <ProtocolSelector
        protocolIds={["proto-1", "proto-2"]}
        selectedProtocolId="proto-1"
        selectedProtocolName="Test Protocol"
        onProtocolChange={handleChange}
      />,
    );

    await user.click(screen.getByRole("combobox"));

    const options = screen.getAllByRole("option");
    await user.click(options[1]);

    expect(handleChange).toHaveBeenCalledWith("proto-2");
  });

  it("renders protocol items in dropdown", async () => {
    const user = userEvent.setup();
    mountProtocol();

    render(
      <ProtocolSelector
        protocolIds={["proto-1", "proto-2", "proto-3"]}
        selectedProtocolId="proto-1"
        selectedProtocolName="Protocol 1"
        onProtocolChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("combobox"));

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
  });
});
