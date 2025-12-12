import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { Breadcrumbs } from "./app-breadcrumbs";

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

  it("renders home breadcrumb on platform root", () => {
    mockUsePathname.mockReturnValue("/en-US/platform");

    render(<Breadcrumbs locale="en-US" />);

    expect(screen.getByText("breadcrumbs.home")).toBeInTheDocument();
    expect(screen.getByText("breadcrumbs.home").closest("a")).toHaveAttribute(
      "href",
      "/en-US/platform",
    );
  });

  it("renders breadcrumb trail for experiments page", () => {
    mockUsePathname.mockReturnValue("/en-US/platform/experiments");

    render(<Breadcrumbs locale="en-US" />);

    expect(screen.getByText("breadcrumbs.home")).toBeInTheDocument();
    expect(screen.getByText("breadcrumbs.experiments")).toBeInTheDocument();
  });

  it("renders breadcrumb trail for nested path", () => {
    mockUsePathname.mockReturnValue("/en-US/platform/experiments/new");

    render(<Breadcrumbs locale="en-US" />);

    expect(screen.getByText("breadcrumbs.home")).toBeInTheDocument();
    expect(screen.getByText("breadcrumbs.experiments")).toBeInTheDocument();
    expect(screen.getByText("breadcrumbs.new")).toBeInTheDocument();
  });

  it("uses pageTitle override for last breadcrumb", () => {
    mockUsePathname.mockReturnValue("/en-US/platform/experiments/123");

    render(<Breadcrumbs locale="en-US" pageTitle="My Experiment" />);

    expect(screen.getByText("breadcrumbs.home")).toBeInTheDocument();
    expect(screen.getByText("breadcrumbs.experiments")).toBeInTheDocument();
    expect(screen.getByText("My Experiment")).toBeInTheDocument();
  });

  it("capitalizes unknown path segments", () => {
    mockUsePathname.mockReturnValue("/en-US/platform/unknown-route");

    render(<Breadcrumbs locale="en-US" />);

    expect(screen.getByText("breadcrumbs.home")).toBeInTheDocument();
    expect(screen.getByText("Unknown-route")).toBeInTheDocument();
  });

  it("generates correct href for each breadcrumb level", () => {
    mockUsePathname.mockReturnValue("/en-US/platform/experiments/123/edit");

    render(<Breadcrumbs locale="en-US" />);

    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/en-US/platform");
    expect(links[1]).toHaveAttribute("href", "/en-US/platform/experiments");
    expect(links[2]).toHaveAttribute("href", "/en-US/platform/experiments/123");
    expect(links[3]).toHaveAttribute("href", "/en-US/platform/experiments/123/edit");
  });

  it("handles different locales correctly", () => {
    mockUsePathname.mockReturnValue("/de/platform/experiments");

    render(<Breadcrumbs locale="de" />);

    const homeLink = screen.getByText("breadcrumbs.home").closest("a");
    expect(homeLink).toHaveAttribute("href", "/de/platform");
  });

  it("renders separators between breadcrumb items", () => {
    mockUsePathname.mockReturnValue("/en-US/platform/experiments/new");

    const { container } = render(<Breadcrumbs locale="en-US" />);

    const separators = container.querySelectorAll("span");
    // Should have 2 separators (between Home->Experiments, Experiments->New)
    expect(separators.length).toBe(2);
  });

  it("updates when pathname changes", () => {
    mockUsePathname.mockReturnValue("/en-US/platform/experiments");

    const { rerender } = render(<Breadcrumbs locale="en-US" />);
    expect(screen.getByText("breadcrumbs.experiments")).toBeInTheDocument();

    // Simulate navigation
    mockUsePathname.mockReturnValue("/en-US/platform/account");
    rerender(<Breadcrumbs locale="en-US" />);

    expect(screen.getByText("breadcrumbs.account")).toBeInTheDocument();
    expect(screen.queryByText("breadcrumbs.experiments")).not.toBeInTheDocument();
  });

  it("translates all known breadcrumb segments", () => {
    mockUsePathname.mockReturnValue("/en-US/platform/experiments/new");

    render(<Breadcrumbs locale="en-US" />);

    expect(screen.getByText("breadcrumbs.experiments")).toBeInTheDocument();
    expect(screen.getByText("breadcrumbs.new")).toBeInTheDocument();
  });

  it("handles edit segment translation", () => {
    mockUsePathname.mockReturnValue("/en-US/platform/experiments/123/edit");

    render(<Breadcrumbs locale="en-US" />);

    expect(screen.getByText("breadcrumbs.edit")).toBeInTheDocument();
  });

  it("handles view segment translation", () => {
    mockUsePathname.mockReturnValue("/en-US/platform/experiments/123/view");

    render(<Breadcrumbs locale="en-US" />);

    expect(screen.getByText("breadcrumbs.view")).toBeInTheDocument();
  });

  it("handles settings segment translation", () => {
    mockUsePathname.mockReturnValue("/en-US/platform/settings");

    render(<Breadcrumbs locale="en-US" />);

    expect(screen.getByText("breadcrumbs.settings")).toBeInTheDocument();
  });

  it("handles empty pageTitle by using translation", () => {
    mockUsePathname.mockReturnValue("/en-US/platform/experiments/new");

    render(<Breadcrumbs locale="en-US" pageTitle="" />);

    const links = screen.getAllByRole("link");
    const lastLink = links[links.length - 1];
    expect(lastLink.textContent).toBe("breadcrumbs.new");
  });

  it("filters out locale from displayed segments", () => {
    mockUsePathname.mockReturnValue("/en-US/platform/experiments");

    render(<Breadcrumbs locale="en-US" />);

    expect(screen.queryByText("en-US")).not.toBeInTheDocument();
    expect(screen.queryByText("En-US")).not.toBeInTheDocument();
  });
});
