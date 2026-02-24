import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { Protocol } from "@repo/api";

import { ProtocolOverviewCards } from "./protocol-overview-cards";

const makeProtocol = (overrides: Partial<Protocol> = {}): Protocol =>
  ({
    id: "p-1",
    name: "Test Protocol",
    family: "MultispeQ",
    createdByName: "Bob",
    updatedAt: "2025-01-01T00:00:00Z",
    sortOrder: null,
    ...overrides,
  }) as Protocol;

describe("ProtocolOverviewCards", () => {
  it("shows loading skeletons when undefined", () => {
    const { container } = render(<ProtocolOverviewCards protocols={undefined} />);
    expect(container.querySelectorAll("[class*=animate]").length).toBeGreaterThan(0);
  });

  it("shows empty message when no protocols", () => {
    render(<ProtocolOverviewCards protocols={[]} />);
    expect(screen.getByText("protocols.noProtocols")).toBeInTheDocument();
  });

  it("renders protocol cards with name and family", () => {
    render(<ProtocolOverviewCards protocols={[makeProtocol()]} />);

    expect(screen.getByText("Test Protocol")).toBeInTheDocument();
    expect(screen.getByText("MultispeQ")).toBeInTheDocument();
  });

  it("shows preferred badge for sorted protocols", () => {
    render(<ProtocolOverviewCards protocols={[makeProtocol({ sortOrder: 1 })]} />);
    expect(screen.getByText("common.preferred")).toBeInTheDocument();
  });

  it("links to protocol detail page", () => {
    render(<ProtocolOverviewCards protocols={[makeProtocol()]} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/platform/protocols/p-1");
  });
});
