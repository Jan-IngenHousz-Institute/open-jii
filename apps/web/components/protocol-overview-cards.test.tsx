import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { ProtocolOverviewCards } from "./protocol-overview-cards";

// Mock Next.js Link component
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href} data-testid="protocol-link">
      {children}
    </a>
  ),
}));

// Mock translation
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock formatDate
vi.mock("~/util/date", () => ({
  formatDate: (dateString: string) => `formatted-${dateString}`,
}));

// Mock Lucide icons
vi.mock("lucide-react", () => ({
  Calendar: () => <div data-testid="icon-calendar" />,
  User: () => <div data-testid="icon-user" />,
  Webcam: () => <div data-testid="icon-webcam" />,
  ChevronRight: () => <div data-testid="icon-chevron-right" />,
}));

describe("<ProtocolOverviewCards />", () => {
  const mockProtocols = [
    {
      id: "protocol1",
      name: "Fv/FM Baseline",
      description: "Dark adaptation protocol",
      code: [{ step: 1 }],
      family: "multispeq" as const,
      sortOrder: null,
      createdBy: "user1",
      createdByName: "User One",
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-15T00:00:00Z",
    },
    {
      id: "protocol2",
      name: "Ambient Light",
      description: "Measure ambient light",
      code: [{ step: 2 }],
      family: "ambit" as const,
      sortOrder: null,
      createdBy: "user2",
      createdByName: "User Two",
      createdAt: "2023-02-01T00:00:00Z",
      updatedAt: "2023-02-15T00:00:00Z",
    },
    {
      id: "protocol3",
      name: "PAM Fluorometry",
      description: "Pulse amplitude modulation",
      code: [{ step: 3 }],
      family: "multispeq" as const,
      sortOrder: 1,
      createdBy: "user3",
      createdByName: "User Three",
      createdAt: "2023-03-01T00:00:00Z",
      updatedAt: "2023-03-15T00:00:00Z",
    },
  ];

  it("renders loading state when protocols is undefined", () => {
    const { container } = render(<ProtocolOverviewCards protocols={undefined} />);

    // Check for skeleton loaders
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders 'no protocols' message when protocols array is empty", () => {
    render(<ProtocolOverviewCards protocols={[]} />);

    expect(screen.getByText("protocols.noProtocols")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders a grid of protocol cards when protocols are provided", () => {
    render(<ProtocolOverviewCards protocols={mockProtocols} />);

    // Check that we have 3 links (one for each card)
    const links = screen.getAllByTestId("protocol-link");
    expect(links).toHaveLength(3);

    // Check that all protocol names are displayed
    expect(screen.getByText("Fv/FM Baseline")).toBeInTheDocument();
    expect(screen.getByText("Ambient Light")).toBeInTheDocument();
    expect(screen.getByText("PAM Fluorometry")).toBeInTheDocument();
  });

  it("renders correct family information", () => {
    render(<ProtocolOverviewCards protocols={mockProtocols} />);

    // Check that family information is displayed
    expect(screen.getAllByText("multispeq")).toHaveLength(2);
    expect(screen.getByText("ambit")).toBeInTheDocument();
  });

  it("renders creator name and update date information", () => {
    render(<ProtocolOverviewCards protocols={mockProtocols} />);

    // Check for creator names
    expect(screen.getByText("User One")).toBeInTheDocument();
    expect(screen.getByText("User Two")).toBeInTheDocument();
    expect(screen.getByText("User Three")).toBeInTheDocument();

    // Check for formatted dates - using regex to match text content that contains the formatted date
    expect(screen.getByText(/formatted-2023-01-15T00:00:00Z/)).toBeInTheDocument();
    expect(screen.getByText(/formatted-2023-02-15T00:00:00Z/)).toBeInTheDocument();
    expect(screen.getByText(/formatted-2023-03-15T00:00:00Z/)).toBeInTheDocument();

    // Check for the "Updated" text using getAllByText since there are multiple instances
    expect(screen.getAllByText(/Updated/)).toHaveLength(3);
  });

  it("renders preferred protocol with Preferred badge", () => {
    render(<ProtocolOverviewCards protocols={mockProtocols} />);

    const badge = screen.getByText("common.preferred");
    expect(badge).toBeInTheDocument();
  });

  it("renders chevron icons on mobile", () => {
    render(<ProtocolOverviewCards protocols={mockProtocols} />);

    // Check for chevron icons (one per card)
    const chevrons = screen.getAllByTestId("icon-chevron-right");
    expect(chevrons).toHaveLength(3);
  });

  it("creates links to individual protocol pages", () => {
    render(<ProtocolOverviewCards protocols={mockProtocols} />);

    const links = screen.getAllByTestId("protocol-link");
    expect(links).toHaveLength(3);

    // Check that links have the correct hrefs
    expect(links[0]).toHaveAttribute("href", "/platform/protocols/protocol1");
    expect(links[1]).toHaveAttribute("href", "/platform/protocols/protocol2");
    expect(links[2]).toHaveAttribute("href", "/platform/protocols/protocol3");
  });

  it("renders webcam icons for family", () => {
    render(<ProtocolOverviewCards protocols={mockProtocols} />);

    // Check for webcam icons (one per card for family)
    const webcamIcons = screen.getAllByTestId("icon-webcam");
    expect(webcamIcons).toHaveLength(3);
  });

  it("renders user icons for creator", () => {
    render(<ProtocolOverviewCards protocols={mockProtocols} />);

    // Check for user icons (one per card for creator)
    const userIcons = screen.getAllByTestId("icon-user");
    expect(userIcons).toHaveLength(3);
  });

  it("renders calendar icons for update date", () => {
    render(<ProtocolOverviewCards protocols={mockProtocols} />);

    // Check for calendar icons (one per card for update date)
    const calendarIcons = screen.getAllByTestId("icon-calendar");
    expect(calendarIcons).toHaveLength(3);
  });
});
