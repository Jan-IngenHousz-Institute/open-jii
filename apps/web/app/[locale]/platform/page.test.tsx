import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import Page from "./page";

vi.mock("@/features/dashboard/components/dashboard-banner", () => ({
  DashboardBanner: () => <section aria-label="banner" />,
}));
vi.mock("@/features/dashboard/components/dashboard-section", () => ({
  DashboardSection: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section aria-label={title}>{children}</section>
  ),
}));
vi.mock("@/features/dashboard/components/user-experiments-section", () => ({
  UserExperimentsSection: () => <div>Experiments</div>,
}));
vi.mock("@/features/dashboard/components/blog-posts-section", () => ({
  BlogPostsSection: () => <div>Blog Posts</div>,
}));

describe("PlatformDashboard", () => {
  it("renders heading and both dashboard sections", async () => {
    render(await Page({ params: Promise.resolve({ locale: "en-US" }) }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("dashboard.title");
    expect(screen.getByRole("region", { name: /dashboard.yourExperiments/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /dashboard.recentArticles/i })).toBeInTheDocument();
    expect(screen.getByText("Experiments")).toBeInTheDocument();
    expect(screen.getByText("Blog Posts")).toBeInTheDocument();
  });
});
