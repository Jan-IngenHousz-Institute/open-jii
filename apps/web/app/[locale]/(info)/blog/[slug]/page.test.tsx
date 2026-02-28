import { render, screen } from "@/test/test-utils";
import { notFound } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getContentfulClients } from "~/lib/contentful";

import Page, { generateMetadata } from "./page";

const mockBlogDetail = vi.fn();

vi.mock("@repo/cms/article", () => ({
  ArticleHero: ({ article }: { article?: { title?: string } }) => (
    <section aria-label="article hero">{article?.title}</section>
  ),
  ArticleContent: ({ article }: { article?: { title?: string } }) => (
    <article>{article?.title} content</article>
  ),
  ArticleTileGrid: ({ articles }: { articles: unknown[] }) => (
    <section aria-label="related posts">{articles.length} posts</section>
  ),
}));

vi.mock("@repo/cms/container", () => ({
  Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const blogPost = {
  slug: "test-post",
  title: "Test Post",
  seoFields: {
    pageTitle: "SEO Title",
    pageDescription: "SEO Desc",
    nofollow: false,
    noindex: false,
  },
  relatedBlogPostsCollection: { items: [{ slug: "related-1", title: "Related 1" }] },
};

const defaultResult = {
  pageBlogPostCollection: { items: [blogPost] },
  pageLandingCollection: { items: [{ featuredBlogPost: { slug: "other" } }] },
};

describe("BlogDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getContentfulClients).mockResolvedValue({
      client: { pageBlogDetail: mockBlogDetail },
      previewClient: { pageBlogDetail: mockBlogDetail },
    } as never);
    mockBlogDetail.mockResolvedValue(defaultResult);
  });

  const params = { params: Promise.resolve({ locale: "en-US", slug: "test-post" }) };

  it("generates metadata with SEO fields and alternates", async () => {
    const metadata = await generateMetadata(params);
    expect(metadata.title).toBe("SEO Title");
    expect(metadata.description).toBe("SEO Desc");
    expect(metadata.alternates?.canonical).toBe("test-post");
  });

  it("calls notFound when blog post does not exist", async () => {
    mockBlogDetail.mockResolvedValue({
      pageBlogPostCollection: { items: [] },
      pageLandingCollection: { items: [{}] },
    });
    await Page(params).catch(() => undefined);
    expect(notFound).toHaveBeenCalled();
  });

  it("renders article hero and content", async () => {
    const ui = await Page(params);
    render(ui);
    expect(screen.getByRole("region", { name: /article hero/i })).toHaveTextContent("Test Post");
    expect(screen.getByRole("article")).toHaveTextContent("Test Post content");
  });

  it("shows related posts when available", async () => {
    const ui = await Page(params);
    render(ui);
    expect(screen.getByRole("region", { name: /related posts/i })).toHaveTextContent("1 posts");
  });

  it("hides related section when no related posts", async () => {
    mockBlogDetail.mockResolvedValue({
      pageBlogPostCollection: {
        items: [{ ...blogPost, relatedBlogPostsCollection: { items: [] } }],
      },
      pageLandingCollection: { items: [{}] },
    });
    const ui = await Page(params);
    render(ui);
    expect(screen.queryByRole("region", { name: /related posts/i })).not.toBeInTheDocument();
  });
});
