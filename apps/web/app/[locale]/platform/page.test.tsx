import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import PlatformDashboard from "./page";

globalThis.React = React;

// --- Mocks ---
vi.mock("@repo/i18n/server", () => ({
  __esModule: true,
  default: vi.fn(() => Promise.resolve({ t: (key: string) => key })),
}));

vi.mock("@/components/dashboard/dashboard-section", () => ({
  DashboardSection: ({
    title,
    seeAllLabel,
    seeAllHref,
    locale,
    children,
  }: {
    title: string;
    seeAllLabel: string;
    seeAllHref: string;
    locale: string;
    children: React.ReactNode;
  }) => (
    <div data-testid="dashboard-section" data-locale={locale}>
      <h2>{title}</h2>
      <a href={seeAllHref}>{seeAllLabel}</a>
      {children}
    </div>
  ),
}));

vi.mock("@/components/dashboard/user-experiments-section", () => ({
  UserExperimentsSection: () => <div data-testid="user-experiments-section">User Experiments</div>,
}));

vi.mock("~/components/dashboard/blog-posts-section", () => ({
  BlogPostsSection: ({ locale }: { locale: string }) => (
    <div data-testid="blog-posts-section" data-locale={locale}>
      Blog Posts
    </div>
  ),
}));

// --- Tests ---
describe("PlatformDashboard", () => {
  const locale = "en-US";
  const defaultProps = {
    params: Promise.resolve({ locale }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the dashboard with all components", async () => {
    render(await PlatformDashboard(defaultProps));

    expect(screen.getByText("dashboard.title")).toBeInTheDocument();
    expect(screen.getAllByTestId("dashboard-section")).toHaveLength(2);
    expect(screen.getByTestId("user-experiments-section")).toBeInTheDocument();
    expect(screen.getByTestId("blog-posts-section")).toBeInTheDocument();
  });

  it("passes correct locale to components", async () => {
    render(await PlatformDashboard(defaultProps));

    const dashboardSections = screen.getAllByTestId("dashboard-section");
    dashboardSections.forEach((section) => {
      expect(section).toHaveAttribute("data-locale", "en-US");
    });

    expect(screen.getByTestId("blog-posts-section")).toHaveAttribute("data-locale", "en-US");
  });

  it("renders dashboard sections with correct titles and links", async () => {
    render(await PlatformDashboard(defaultProps));

    expect(screen.getByText("dashboard.yourExperiments")).toBeInTheDocument();
    expect(screen.getByText("dashboard.recentArticles")).toBeInTheDocument();

    const seeAllLinks = screen.getAllByText("dashboard.seeAll");
    expect(seeAllLinks).toHaveLength(2);

    // Check the href attributes
    const allSeeAllLinks = screen.getAllByRole("link", { name: "dashboard.seeAll" });
    expect(allSeeAllLinks[0]).toHaveAttribute("href", "/platform/experiments?filter=all");
    expect(allSeeAllLinks[1]).toHaveAttribute("href", "/blog");
  });

  it("renders with correct structure and spacing", async () => {
    const { container } = render(await PlatformDashboard(defaultProps));

    const mainDiv = container.querySelector(".space-y-8");
    expect(mainDiv).toBeInTheDocument();

    const heading = container.querySelector("h1");
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass("text-3xl", "font-bold", "text-gray-900");
  });

  it("handles different locale", async () => {
    const germanProps = {
      params: Promise.resolve({ locale: "de" }),
    };

    render(await PlatformDashboard(germanProps));

    const dashboardSections = screen.getAllByTestId("dashboard-section");
    dashboardSections.forEach((section) => {
      expect(section).toHaveAttribute("data-locale", "de");
    });

    expect(screen.getByTestId("blog-posts-section")).toHaveAttribute("data-locale", "de");
  });
});
