import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";
import { orpc } from "~/lib/orpc";

import Page from "./page";

const prefetched = vi.hoisted(() => {
  const state: { queries: unknown[] } = { queries: [] };
  return state;
});

vi.mock("@/components/server-prefetch/prefetched-queries", () => ({
  PrefetchedQueries: ({
    queries,
    children,
  }: {
    queries: (utils: unknown) => unknown[];
    children: React.ReactNode;
  }) => {
    prefetched.queries = queries(orpc);
    return children;
  },
}));

vi.mock("@/components/dashboard/dashboard-banner", () => ({
  DashboardBanner: () => <section aria-label="banner" />,
}));
vi.mock("@/components/dashboard/dashboard-section", () => ({
  DashboardSection: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section aria-label={title}>{children}</section>
  ),
}));
vi.mock("@/components/dashboard/user-experiments-section", () => ({
  UserExperimentsSection: () => <div>Experiments</div>,
}));
vi.mock("@/components/dashboard/public-experiments-section", () => ({
  PublicExperimentsSection: () => <div>Public Experiments</div>,
}));
vi.mock("~/components/dashboard/blog-posts-section", () => ({
  BlogPostsSection: () => <div>Blog Posts</div>,
}));

describe("PlatformDashboard", () => {
  it("lets the shell own the dashboard heading and renders both dashboard sections", async () => {
    render(await Page({ params: Promise.resolve({ locale: "en-US" }) }));
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: /dashboard.yourExperiments/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /dashboard.recentArticles/i })).toBeInTheDocument();
    expect(screen.getByText("Experiments")).toBeInTheDocument();
    expect(screen.getByText("Blog Posts")).toBeInTheDocument();
  });

  it("places recently updated public experiments between your experiments and blog posts", async () => {
    render(await Page({ params: Promise.resolve({ locale: "en-US" }) }));
    const names = screen
      .getAllByRole("region")
      .map((region) => region.getAttribute("aria-label"))
      .filter((name) => name?.startsWith("dashboard."));
    expect(names).toEqual([
      "dashboard.yourExperiments",
      "dashboard.recentPublicExperiments",
      "dashboard.recentArticles",
    ]);
    expect(screen.getByText("Public Experiments")).toBeInTheDocument();
  });

  it("fetches both experiment lists on the server so the page arrives with them", async () => {
    render(await Page({ params: Promise.resolve({ locale: "en-US" }) }));

    expect(JSON.stringify(prefetched.queries)).toContain('"scope":"related"');
    expect(JSON.stringify(prefetched.queries)).toContain('"visibility":"public"');
  });
});
