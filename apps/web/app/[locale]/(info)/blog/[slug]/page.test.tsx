import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import BlogSlugPage, { generateMetadata } from "./page";

globalThis.React = React;

// --- Mocks ---
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

vi.mock("next/headers", () => ({
  draftMode: vi.fn(() => Promise.resolve({ isEnabled: false })),
}));

const mockGetContentfulClients = vi.fn();
vi.mock("~/lib/contentful", () => ({
  getContentfulClients: (): unknown => mockGetContentfulClients(),
}));

const mockInitTranslations = vi.fn();
vi.mock("@repo/i18n/server", () => ({
  __esModule: true,
  default: (): unknown => mockInitTranslations(),
}));

vi.mock("@repo/cms/container", () => ({
  Container: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="container" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("@repo/cms/article", () => ({
  ArticleContent: ({ article }: { article: unknown }) => (
    <div data-testid="article-content">{article ? "Article Content" : "No content"}</div>
  ),
  ArticleHero: ({ article }: { article: unknown }) => (
    <div data-testid="article-hero">{article ? "Article Hero" : "No article"}</div>
  ),
  ArticleTileGrid: ({ articles, locale }: { articles: unknown[]; locale: string }) => (
    <div data-testid="article-tile-grid" data-locale={locale}>
      {articles.length} related articles
    </div>
  ),
}));

// --- Tests ---
describe("BlogSlugPage", () => {
  const locale = "en-US";
  const slug = "test-post";
  const defaultProps = {
    params: Promise.resolve({ locale, slug }),
  };

  const mockBlogPostData = {
    pageBlogPostCollection: {
      items: [
        {
          slug: "test-post",
          title: "Test Post",
          sys: { id: "post-1" },
          seoFields: {
            pageTitle: "Test Post Title",
            pageDescription: "Test post description",
            nofollow: false,
            noindex: false,
          },
          relatedBlogPostsCollection: {
            items: [
              { title: "Related Post 1", slug: "related-1" },
              { title: "Related Post 2", slug: "related-2" },
            ],
          },
        },
      ],
    },
  };

  const mockRelatedPostsData = {
    pageBlogPostCollection: {
      items: [
        { title: "Related Post 1", slug: "related-1" },
        { title: "Related Post 2", slug: "related-2" },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContentfulClients.mockResolvedValue({
      client: {
        pageBlogPost: vi.fn().mockResolvedValue(mockBlogPostData),
        pageBlogPostCollection: vi.fn().mockResolvedValue(mockRelatedPostsData),
        pageLanding: vi.fn().mockResolvedValue({ pageLandingCollection: { items: [{}] } }),
      },
      previewClient: {
        pageBlogPost: vi.fn().mockResolvedValue(mockBlogPostData),
        pageBlogPostCollection: vi.fn().mockResolvedValue(mockRelatedPostsData),
        pageLanding: vi.fn().mockResolvedValue({ pageLandingCollection: { items: [{}] } }),
      },
    });
    mockInitTranslations.mockResolvedValue({
      t: (key: string) => key,
      resources: {},
    });
  });

  describe("generateMetadata", () => {
    it("should generate metadata from blog post data", async () => {
      const metadata = await generateMetadata(defaultProps);

      expect(metadata).toEqual({
        alternates: {
          canonical: "test-post",
          languages: {
            "de-DE": "/de-DE/test-post",
            "en-US": "/test-post",
          },
        },
        title: "Test Post Title",
        description: "Test post description",
        robots: {
          follow: true,
          index: true,
        },
      });
    });

    it("should handle missing SEO fields", async () => {
      const postDataWithoutSeo = {
        pageBlogPostCollection: {
          items: [
            {
              slug: "test-post",
              title: "Test Post",
            },
          ],
        },
      };

      mockGetContentfulClients.mockResolvedValueOnce({
        client: {
          pageBlogPost: vi.fn().mockResolvedValue(postDataWithoutSeo),
        },
        previewClient: {
          pageBlogPost: vi.fn().mockResolvedValue(postDataWithoutSeo),
        },
      });

      const metadata = await generateMetadata(defaultProps);

      expect(metadata).toEqual({
        alternates: {
          canonical: "test-post",
          languages: {
            "de-DE": "/de-DE/test-post",
            "en-US": "/test-post",
          },
        },
      });
    });
  });

  describe("Component", () => {
    it("renders the blog post page with all components", async () => {
      render(await BlogSlugPage(defaultProps));

      expect(screen.getByTestId("article-hero")).toBeInTheDocument();
      expect(screen.getByTestId("article-content")).toBeInTheDocument();
      expect(screen.getByTestId("article-tile-grid")).toBeInTheDocument();
      expect(screen.getByText("article.relatedArticles")).toBeInTheDocument();
    });

    it("passes correct locale to components", async () => {
      render(await BlogSlugPage(defaultProps));

      expect(screen.getByTestId("article-tile-grid")).toHaveAttribute("data-locale", "en-US");
    });

    it("displays related articles count", async () => {
      render(await BlogSlugPage(defaultProps));

      expect(screen.getByTestId("article-tile-grid")).toHaveTextContent("2 related articles");
    });

    it("calls notFound when blog post is missing", async () => {
      mockGetContentfulClients.mockResolvedValueOnce({
        client: {
          pageBlogPost: vi.fn().mockResolvedValue({ pageBlogPostCollection: { items: [] } }),
          pageBlogPostCollection: vi.fn().mockResolvedValue(mockRelatedPostsData),
          pageLanding: vi.fn().mockResolvedValue({ pageLandingCollection: { items: [{}] } }),
        },
        previewClient: {
          pageBlogPost: vi.fn().mockResolvedValue({ pageBlogPostCollection: { items: [] } }),
          pageBlogPostCollection: vi.fn().mockResolvedValue(mockRelatedPostsData),
          pageLanding: vi.fn().mockResolvedValue({ pageLandingCollection: { items: [{}] } }),
        },
      });

      await BlogSlugPage(defaultProps);
      expect(notFound).toHaveBeenCalled();
    });

    it("handles case when no related posts exist", async () => {
      const mockBlogPostDataNoRelated = {
        pageBlogPostCollection: {
          items: [
            {
              slug: "test-post",
              title: "Test Post",
              sys: { id: "post-1" },
              seoFields: {
                pageTitle: "Test Post Title",
                pageDescription: "Test post description",
                nofollow: false,
                noindex: false,
              },
              relatedBlogPostsCollection: {
                items: [],
              },
            },
          ],
        },
      };

      mockGetContentfulClients.mockResolvedValueOnce({
        client: {
          pageBlogPost: vi.fn().mockResolvedValue(mockBlogPostDataNoRelated),
          pageBlogPostCollection: vi.fn().mockResolvedValue(mockRelatedPostsData),
          pageLanding: vi.fn().mockResolvedValue({ pageLandingCollection: { items: [{}] } }),
        },
        previewClient: {
          pageBlogPost: vi.fn().mockResolvedValue(mockBlogPostDataNoRelated),
          pageBlogPostCollection: vi.fn().mockResolvedValue(mockRelatedPostsData),
          pageLanding: vi.fn().mockResolvedValue({ pageLandingCollection: { items: [{}] } }),
        },
      });

      render(await BlogSlugPage(defaultProps));

      expect(screen.queryByTestId("article-tile-grid")).not.toBeInTheDocument();
    });

    it("displays related articles from the blog post data", async () => {
      render(await BlogSlugPage(defaultProps));

      expect(screen.getByTestId("article-tile-grid")).toHaveTextContent("2 related articles");
      expect(screen.getByTestId("article-tile-grid")).toHaveAttribute("data-locale", "en-US");
    });
  });
});
