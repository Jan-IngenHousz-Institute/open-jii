import { createProtocol } from "@/test/factories";
import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import type { Protocol } from "@repo/api";

import { ProtocolCard, ProtocolSelector } from "./protocol-card";

// ---------- Hoisted mocks ----------
const { useProtocolSpy } = vi.hoisted(() => {
  return {
    useProtocolSpy: vi.fn(() => ({
      data: null as { body: Protocol } | null,
      isLoading: false,
    })),
  };
});

// ---------- Mocks ----------
vi.mock("../../../hooks/protocol/useProtocol/useProtocol", () => ({
  useProtocol: () => useProtocolSpy(),
}));

vi.mock("@/util/date", () => ({
  formatDate: (dateString: string) => `formatted-${dateString}`,
}));

vi.mock("@repo/ui/components", async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const actual = await importOriginal();
  return {
    ...actual,
    RichTextRenderer: ({ content }: { content: string }) => (
      <div data-testid="rich-text-renderer">{content}</div>
    ),
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

describe("ProtocolCard", () => {
  const mockProtocol = createProtocol({
    id: "proto-1",
    name: "Test Protocol",
    description: "Test protocol description",
    family: "multispeq",
    code: [],
    createdBy: "user-1",
    createdByName: "Test User",
    createdAt: "2023-01-01T00:00:00Z",
    updatedAt: "2023-01-15T00:00:00Z",
  });

  it("renders loading state", () => {
    render(<ProtocolCard protocol={undefined} isLoading={true} error={null} />);

    // Loading renders skeleton, not the protocol content
    expect(screen.queryByText("protocols.unableToLoadProtocol")).not.toBeInTheDocument();
    expect(screen.queryByText("multispeq")).not.toBeInTheDocument();
  });

  it("renders error state", () => {
    render(<ProtocolCard protocol={undefined} isLoading={false} error={new Error("Failed")} />);

    expect(screen.getByText("protocols.unableToLoadProtocol")).toBeInTheDocument();
  });

  it("renders protocol metadata", () => {
    render(<ProtocolCard protocol={mockProtocol} isLoading={false} error={null} />);

    expect(screen.getByText("multispeq")).toBeInTheDocument();
    expect(screen.getByText("formatted-2023-01-15T00:00:00Z")).toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });

  it("renders protocol description", () => {
    render(<ProtocolCard protocol={mockProtocol} isLoading={false} error={null} />);

    expect(screen.getByText("Test protocol description")).toBeInTheDocument();
  });

  it("does not render empty description", () => {
    const protocolWithoutDesc = { ...mockProtocol, description: "<p><br></p>" };
    render(<ProtocolCard protocol={protocolWithoutDesc} isLoading={false} error={null} />);

    expect(screen.queryByTestId("rich-text-renderer")).not.toBeInTheDocument();
  });

  it("shows fade gradient when description visually overflows", () => {
    mockOverflow({ scrollHeight: 500, clientHeight: 100 });

    render(<ProtocolCard protocol={mockProtocol} isLoading={false} error={null} />);

    const fadeElement = document.querySelector(".bg-gradient-to-t");
    expect(fadeElement).toBeInTheDocument();
  });

  it("does not show fade gradient when description does not overflow", () => {
    mockOverflow({ scrollHeight: 100, clientHeight: 500 });

    render(<ProtocolCard protocol={mockProtocol} isLoading={false} error={null} />);

    const fadeElement = document.querySelector(".bg-gradient-to-t");
    expect(fadeElement).not.toBeInTheDocument();
  });

  it("renders without creator name", () => {
    const protocolWithoutCreator = { ...mockProtocol, createdByName: undefined };
    render(<ProtocolCard protocol={protocolWithoutCreator} isLoading={false} error={null} />);

    expect(screen.queryByText("Test User")).not.toBeInTheDocument();
  });
});

describe("ProtocolSelector", () => {
  it("renders protocol selector with selected protocol", () => {
    useProtocolSpy.mockReturnValue({
      data: {
        body: {
          id: "proto-1",
          name: "Selected Protocol",
          code: [],
          family: "multispeq",
          createdBy: "user-1",
          description: null,
          createdAt: "2023-01-01T00:00:00Z",
          updatedAt: "2023-01-15T00:00:00Z",
        } as Protocol,
      },
      isLoading: false,
    });

    const handleChange = vi.fn();

    render(
      <ProtocolSelector
        protocolIds={["proto-1", "proto-2"]}
        selectedProtocolId="proto-1"
        selectedProtocolName="Selected Protocol"
        onProtocolChange={handleChange}
      />,
    );

    expect(screen.getAllByText("Selected Protocol").length).toBeGreaterThan(0);
  });

  it("shows loading state when no protocol name", () => {
    useProtocolSpy.mockReturnValue({
      data: null,
      isLoading: false,
    });

    const handleChange = vi.fn();

    render(
      <ProtocolSelector
        protocolIds={["proto-1"]}
        selectedProtocolId="proto-1"
        onProtocolChange={handleChange}
      />,
    );

    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("calls onProtocolChange when selection changes", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    useProtocolSpy.mockReturnValue({
      data: {
        body: {
          id: "proto-1",
          name: "Test Protocol",
          code: [],
          family: "multispeq",
          createdBy: "user-1",
          description: null,
          createdAt: "2023-01-01T00:00:00Z",
          updatedAt: "2023-01-15T00:00:00Z",
        } as Protocol,
      },
      isLoading: false,
    });

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

    useProtocolSpy.mockReturnValue({
      data: {
        body: {
          id: "proto-1",
          name: "Protocol 1",
          code: [],
          family: "multispeq",
          createdBy: "user-1",
          description: null,
          createdAt: "2023-01-01T00:00:00Z",
          updatedAt: "2023-01-15T00:00:00Z",
        } as Protocol,
      },
      isLoading: false,
    });

    const handleChange = vi.fn();

    render(
      <ProtocolSelector
        protocolIds={["proto-1", "proto-2", "proto-3"]}
        selectedProtocolId="proto-1"
        selectedProtocolName="Protocol 1"
        onProtocolChange={handleChange}
      />,
    );

    await user.click(screen.getByRole("combobox"));

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
  });
});
