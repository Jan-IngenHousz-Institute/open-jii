import { render, screen } from "@/test/test-utils";
import { notFound } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPageBlog = vi.fn();
vi.mock("~/lib/contentful", () => ({
  getContentfulClients: vi.fn().mockResolvedValue({
    client: { pageBlog: (...a: unknown[]) => mockPageBlog(...a) },
    previewClient: { pageBlog: (...a: unknown[]) => mockPageBlog(...a) },
  }),
}));

vi.mock("@repo/cms/article", () => ({
  ArticleHero: ({ article }: { article?: { title?: string } }) => (
    <section aria-label="featured hero">{article?.title}</section>
  ),
  ArticleTileGrid: ({ articles }: { articles: unknown[] }) => (
    <section aria-label="post grid">{articles.length} posts</section>
  ),
}));

vi.mock("@repo/cms/container", () => ({
  Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/translations-provider", () => ({
  TranslationsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const featuredPost = { slug: "featured", title: "Featured Post" };
const otherPosts = [
  { slug: "post-1", title: "Post 1" },
  { slug: "post-2", title: "Post 2" },
];

const defaultResult = {
  pageLandingCollection: {
    items: [
      {
        featuredBlogPost: featuredPost,
        seoFields: { pageTitle: "Blog", pageDescription: "Our blog" },
      },
    ],
  },
  pageBlogPostCollection: { items: [featuredPost, ...otherPosts] },
};

describe("BlogLandingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPageBlog.mockResolvedValue(defaultResult);
  });

  const params = { params: Promise.resolve({ locale: "en-US" }) };

  it("generates metadata with SEO fields", async () => {
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata(params);
    expect(metadata.title).toBe("Blog");
    expect(metadata.description).toBe("Our blog");
  });

  it("calls notFound when landing page is missing", async () => {
    mockPageBlog.mockResolvedValue({
      pageLandingCollection: { items: [] },
      pageBlogPostCollection: { items: [] },
    });
    const { default: Page } = await import("./page");
    await Page(params)?.catch?.(() => {});
    expect(notFound).toHaveBeenCalled();
  });

  it("renders featured hero and post grid", async () => {
    const { default: Page } = await import("./page");
    const ui = await Page(params);
    render(ui!);
    expect(screen.getByRole("region", { name: /featured hero/i })).toHaveTextContent(
      "Featured Post",
    );
    expect(screen.getByRole("region", { name: /post grid/i })).toHaveTextContent("2 posts");
  });

  it("returns undefined when no featured post or no posts", async () => {
    mockPageBlog.mockResolvedValue({
      pageLandingCollection: { items: [{ featuredBlogPost: null, seoFields: null }] },
      pageBlogPostCollection: { items: [] },
    });
    const { default: Page } = await import("./page");
    const ui = await Page(params);
    expect(ui).toBeUndefined();
  });
});
