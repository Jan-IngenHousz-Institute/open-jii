import { createProtocol } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ProtocolOverviewCards } from "./protocol-overview-cards";

describe("ProtocolOverviewCards", () => {
  it("shows loading skeletons when undefined", () => {
    render(<ProtocolOverviewCards protocols={undefined} />);
    expect(document.querySelectorAll("[class*=animate]").length).toBeGreaterThan(0);
  });

  it("shows empty message when no protocols", () => {
    render(<ProtocolOverviewCards protocols={[]} />);
    expect(screen.getByText("protocols.noProtocols")).toBeInTheDocument();
  });

  it("renders protocol cards with name and family", () => {
    render(
      <ProtocolOverviewCards
        protocols={[createProtocol({ name: "Test Protocol", family: "MultispeQ" })]}
      />,
    );

    expect(screen.getByText("Test Protocol")).toBeInTheDocument();
    expect(screen.getByText("MultispeQ")).toBeInTheDocument();
  });

  it("shows preferred badge for sorted protocols", () => {
    render(<ProtocolOverviewCards protocols={[createProtocol({ sortOrder: 1 })]} />);
    expect(screen.getByText("common.preferred")).toBeInTheDocument();
  });

  it("links to protocol detail page", () => {
    render(<ProtocolOverviewCards protocols={[createProtocol({ id: "p-1" })]} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/en-US/platform/protocols/p-1");
  });
});
