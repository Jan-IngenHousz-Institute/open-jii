import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ProtocolSettings } from "../protocol-settings";

globalThis.React = React;

// --------------------
// Mocks
// --------------------

vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

interface MockProtocolReturn {
  data: { body: Record<string, unknown> } | undefined;
  isLoading: boolean;
}

const mockUseProtocol = vi.fn<() => MockProtocolReturn>();
vi.mock("../../../hooks/protocol/useProtocol/useProtocol", () => ({
  useProtocol: () => mockUseProtocol(),
}));

vi.mock("../protocol-details-card", () => ({
  ProtocolDetailsCard: () => <div data-testid="details-card" />,
}));

vi.mock("../protocol-compatible-macros-card", () => ({
  ProtocolCompatibleMacrosCard: () => <div data-testid="macros-card" />,
}));

vi.mock("../protocol-info-card", () => ({
  ProtocolInfoCard: () => <div data-testid="info-card" />,
}));

// --------------------
// Tests
// --------------------
describe("<ProtocolSettings />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show loading state", () => {
    mockUseProtocol.mockReturnValue({ data: undefined, isLoading: true });

    render(<ProtocolSettings protocolId="proto-1" />);

    expect(screen.getByText("protocolSettings.loading")).toBeInTheDocument();
  });

  it("should show not found when no data", () => {
    mockUseProtocol.mockReturnValue({ data: undefined, isLoading: false });

    render(<ProtocolSettings protocolId="proto-1" />);

    expect(screen.getByText("protocolSettings.notFound")).toBeInTheDocument();
  });

  it("should render child cards on success", () => {
    mockUseProtocol.mockReturnValue({
      data: {
        body: {
          name: "Test",
          description: "desc",
          code: "[]",
          family: "multispeq",
        },
      },
      isLoading: false,
    });

    render(<ProtocolSettings protocolId="proto-1" />);

    expect(screen.getByTestId("details-card")).toBeInTheDocument();
    expect(screen.getByTestId("macros-card")).toBeInTheDocument();
    expect(screen.getByTestId("info-card")).toBeInTheDocument();
  });
});
