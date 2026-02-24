import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { BlogPostsSection } from "./blog-posts-section";

const { mockGqlClient, mockGetContentfulClients } = vi.hoisted(() => {
  const mockGqlClient = { pageBlogPostCollection: vi.fn() };
  return {
    mockGqlClient,
    mockGetContentfulClients: vi.fn().mockResolvedValue({
      client: mockGqlClient,
      previewClient: mockGqlClient,
    }),
  };
});

vi.mock("~/lib/contentful", () => ({
  getContentfulClients: mockGetContentfulClients,
}));

vi.mock("@repo/cms/article", () => ({
  ArticleTileGrid: (props: { articles: unknown[] }) => (
    <div data-testid="article-grid">{props.articles.length} articles</div>
  ),
}));

describe("BlogPostsSection", () => {
  it("renders articles", async () => {
    mockGqlClient.pageBlogPostCollection.mockResolvedValue({
      pageBlogPostCollection: {
        items: [{ sys: { id: "1" } }, { sys: { id: "2" } }],
      },
    });

    const ui = await BlogPostsSection({ locale: "en-US" });
    render(ui);

    expect(screen.getByTestId("article-grid")).toHaveTextContent("2 articles");
  });

  it("shows empty state when no posts", async () => {
    mockGqlClient.pageBlogPostCollection.mockResolvedValue({
      pageBlogPostCollection: { items: [] },
    });

    const ui = await BlogPostsSection({ locale: "en-US" });
    render(ui);

    expect(screen.getByText("dashboard.noBlogPosts")).toBeInTheDocument();
  });

  it("shows error state on failure", async () => {
    mockGqlClient.pageBlogPostCollection.mockRejectedValue(new Error("fail"));

    const ui = await BlogPostsSection({ locale: "en-US" });
    render(ui);

    expect(screen.getByText("dashboard.errorLoadingBlogPosts")).toBeInTheDocument();
  });
});
