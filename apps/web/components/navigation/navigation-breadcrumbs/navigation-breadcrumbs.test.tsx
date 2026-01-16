import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { Breadcrumbs } from "./navigation-breadcrumbs";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

// Mock @repo/i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../breadcrumb-context", () => ({
  useBreadcrumbContext: () => ({
    nameMappings: {
      "a1b2c3d4-e5f6-4890-abcd-ef1234567890": "My Experiment",
    },
  }),
}));

// Mock @repo/ui/components
vi.mock("@repo/ui/components", () => ({
  Breadcrumb: ({ children }: { children: React.ReactNode }) => <nav>{children}</nav>,
  BreadcrumbList: ({ children }: { children: React.ReactNode }) => <ol>{children}</ol>,
  BreadcrumbItem: ({ children }: { children: React.ReactNode }) => <li>{children}</li>,
  BreadcrumbLink: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  BreadcrumbSeparator: () => <span>/</span>,
}));

describe("Breadcrumbs", () => {
  const mockUsePathname = usePathname as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing on platform root", () => {
    mockUsePathname.mockReturnValue("/en/platform");

    const { container } = render(<Breadcrumbs locale="en" />);

    // Component returns null when on platform root (no sub-paths)
    expect(container.firstChild).toBeNull();
  });

  it("renders breadcrumb trail for experiments page", () => {
    mockUsePathname.mockReturnValue("/en/platform/experiments");

    const { container } = render(<Breadcrumbs locale="en" />);

    // Should return null for first-level routes
    expect(container.firstChild).toBeNull();
  });

  it("renders breadcrumb trail for nested path", () => {
    mockUsePathname.mockReturnValue("/en/platform/experiments/new");

    render(<Breadcrumbs locale="en" />);

    expect(screen.getByText("breadcrumbs.experiments")).toBeInTheDocument();
    expect(screen.getByText("breadcrumbs.new")).toBeInTheDocument();
  });

  it("uses name mapping for UUID segments", () => {
    mockUsePathname.mockReturnValue(
      "/en/platform/experiments/a1b2c3d4-e5f6-4890-abcd-ef1234567890",
    );

    render(<Breadcrumbs locale="en" />);

    expect(screen.getByText("breadcrumbs.experiments")).toBeInTheDocument();
    // UUID with mapping displays the mapped name
    expect(screen.getByText("My Experiment")).toBeInTheDocument();
  });

  it("capitalizes unknown path segments", () => {
    mockUsePathname.mockReturnValue("/en/platform/experiments/unknown-route");

    render(<Breadcrumbs locale="en" />);

    expect(screen.getByText("breadcrumbs.experiments")).toBeInTheDocument();
    expect(screen.getByText("Unknown Route")).toBeInTheDocument();
  });

  it("generates correct href for each breadcrumb level", () => {
    mockUsePathname.mockReturnValue(
      "/en/platform/experiments/a1b2c3d4-e5f6-4890-abcd-ef1234567890",
    );

    render(<Breadcrumbs locale="en" />);

    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/en/platform/experiments");
    expect(links[1]).toHaveAttribute(
      "href",
      "/en/platform/experiments/a1b2c3d4-e5f6-4890-abcd-ef1234567890",
    );
  });

  it("handles different locales correctly", () => {
    mockUsePathname.mockReturnValue("/de/platform/experiments/new");

    render(<Breadcrumbs locale="de" />);

    const experimentsLink = screen.getByText("breadcrumbs.experiments").closest("a");
    expect(experimentsLink).toHaveAttribute("href", "/de/platform/experiments");
  });

  it("renders separators between breadcrumb items", () => {
    mockUsePathname.mockReturnValue("/en/platform/experiments/new");

    const { container } = render(<Breadcrumbs locale="en" />);

    const separators = container.querySelectorAll("span");
    // Should have 1 separator (between Experiments->New)
    expect(separators.length).toBe(1);
  });

  it("updates when pathname changes", () => {
    mockUsePathname.mockReturnValue("/en/platform/experiments/new");

    const { rerender } = render(<Breadcrumbs locale="en" />);
    expect(screen.getByText("breadcrumbs.experiments")).toBeInTheDocument();

    // Simulate navigation
    mockUsePathname.mockReturnValue("/en/platform/protocols/new");
    rerender(<Breadcrumbs locale="en" />);

    expect(screen.getByText("breadcrumbs.protocols")).toBeInTheDocument();
    expect(screen.queryByText("breadcrumbs.experiments")).not.toBeInTheDocument();
  });

  it("handles missing translationKey by returning capitalized segment", () => {
    mockUsePathname.mockReturnValue("/en/platform/experiments/custom-page");

    render(<Breadcrumbs locale="en" />);

    expect(screen.getByText("Custom Page")).toBeInTheDocument();
  });
});
