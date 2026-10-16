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
  ArticleTileGrid: (props: { articles: unknown[]; horizontal?: boolean }) => (
    <div data-testid="article-grid" data-horizontal={String(props.horizontal)}>
      {props.articles.length} articles
    </div>
  ),
}));

describe("BlogPostsSection", () => {
  it("renders the posts as tiles under a heading that links to the blog", async () => {
    mockGqlClient.pageBlogPostCollection.mockResolvedValue({
      pageBlogPostCollection: {
        items: [{ sys: { id: "1" } }, { sys: { id: "2" } }],
      },
    });

    const section = await BlogPostsSection({ locale: "en-US" });
    if (!section) throw new Error("Expected the section to render");
    render(section);

    expect(screen.getByRole("heading", { name: "dashboard.recentArticles" })).toBeInTheDocument();
    expect(screen.getByTestId("article-grid")).toHaveTextContent("2 articles");
    expect(screen.getByTestId("article-grid")).toHaveAttribute("data-horizontal", "true");
    expect(screen.getByRole("link", { name: "dashboard.seeAll" })).toHaveAttribute(
      "href",
      "/en-US/blog",
    );
  });

  it("renders nothing when there are no posts", async () => {
    mockGqlClient.pageBlogPostCollection.mockResolvedValue({
      pageBlogPostCollection: { items: [] },
    });

    expect(await BlogPostsSection({ locale: "en-US" })).toBeNull();
  });

  it("renders nothing when the CMS fails", async () => {
    mockGqlClient.pageBlogPostCollection.mockRejectedValue(new Error("fail"));

    expect(await BlogPostsSection({ locale: "en-US" })).toBeNull();
  });
});
