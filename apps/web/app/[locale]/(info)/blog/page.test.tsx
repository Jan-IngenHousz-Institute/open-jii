import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import BlogPage, { generateMetadata } from "./page";

globalThis.React = React;

// --- Mocks ---
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    const error = new Error("NEXT_NOT_FOUND");
    error.name = "NotFoundError";
    throw error;
  }),
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

vi.mock("@/components/translations-provider", () => ({
  TranslationsProvider: ({ children, locale }: { children: React.ReactNode; locale: string }) => (
    <div data-testid="translations-provider" data-locale={locale}>
      {children}
    </div>
  ),
}));

vi.mock("@repo/cms/container", () => ({
  Container: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="container" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("@repo/cms/article", () => ({
  ArticleHero: ({ article }: { article: unknown }) => (
    <div data-testid="article-hero">{article ? "Article Hero" : "No article"}</div>
  ),
  ArticleTileGrid: ({
    articles,
    locale,
    className,
  }: {
    articles: unknown[];
    locale: string;
    className: string;
  }) => (
    <div data-testid="article-tile-grid" data-locale={locale} className={className}>
      {articles.length} articles
    </div>
  ),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href} data-testid="link">
      {children}
    </a>
  ),
}));

// --- Tests ---
describe("BlogPage", () => {
  const locale = "en-US";
  const defaultProps = {
    params: Promise.resolve({ locale }),
  };

  const mockLandingPageData = {
    pageLandingCollection: {
      items: [
        {
          seoFields: {
            pageTitle: "Blog Title",
            pageDescription: "Blog description",
            nofollow: false,
            noindex: false,
          },
          featuredBlogPost: {
            slug: "featured-post",
            title: "Featured Post",
          },
        },
      ],
    },
  };

  const mockBlogPostsData = {
    pageBlogPostCollection: {
      items: [
        { title: "Post 1", slug: "post-1" },
        { title: "Post 2", slug: "post-2" },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContentfulClients.mockResolvedValue({
      client: {
        pageLanding: vi.fn().mockResolvedValue(mockLandingPageData),
        pageBlogPostCollection: vi.fn().mockResolvedValue(mockBlogPostsData),
      },
      previewClient: {
        pageLanding: vi.fn().mockResolvedValue(mockLandingPageData),
        pageBlogPostCollection: vi.fn().mockResolvedValue(mockBlogPostsData),
      },
    });
    mockInitTranslations.mockResolvedValue({
      t: (key: string) => key,
      resources: {},
    });
  });

  describe("generateMetadata", () => {
    it("should generate metadata from landing page data", async () => {
      const metadata = await generateMetadata(defaultProps);

      expect(metadata).toEqual({
        alternates: {
          canonical: "/",
          languages: {
            "de-DE": "/de-DE",
            "en-US": "/",
          },
        },
        title: "Blog Title",
        description: "Blog description",
        robots: {
          follow: true,
          index: true,
        },
      });
    });

    it("should handle missing SEO fields", async () => {
      const landingDataWithoutSeo = {
        pageLandingCollection: {
          items: [{}],
        },
      };

      mockGetContentfulClients.mockResolvedValueOnce({
        client: {
          pageLanding: vi.fn().mockResolvedValue(landingDataWithoutSeo),
        },
        previewClient: {
          pageLanding: vi.fn().mockResolvedValue(landingDataWithoutSeo),
        },
      });

      const metadata = await generateMetadata(defaultProps);

      expect(metadata).toEqual({
        alternates: {
          canonical: "/",
          languages: {
            "de-DE": "/de-DE",
            "en-US": "/",
          },
        },
      });
    });
  });

  describe("Component", () => {
    it("renders the blog page with all components", async () => {
      render(await BlogPage(defaultProps));

      expect(screen.getByTestId("translations-provider")).toBeInTheDocument();
      expect(screen.getByTestId("article-hero")).toBeInTheDocument();
      expect(screen.getByTestId("article-tile-grid")).toBeInTheDocument();
      expect(screen.getByText("landingPage.latestArticles")).toBeInTheDocument();
    });

    it("passes correct locale to components", async () => {
      render(await BlogPage(defaultProps));

      expect(screen.getByTestId("translations-provider")).toHaveAttribute("data-locale", "en-US");
      expect(screen.getByTestId("article-tile-grid")).toHaveAttribute("data-locale", "en-US");
    });

    it("creates link to featured blog post", async () => {
      render(await BlogPage(defaultProps));

      const link = screen.getByTestId("link");
      expect(link).toHaveAttribute("href", "/en-US/blog/featured-post");
    });

    it("displays correct number of articles", async () => {
      render(await BlogPage(defaultProps));

      expect(screen.getByTestId("article-tile-grid")).toHaveTextContent("2 articles");
    });

    it("calls notFound when page data is missing", async () => {
      mockGetContentfulClients.mockResolvedValueOnce({
        client: {
          pageLanding: vi.fn().mockResolvedValue({ pageLandingCollection: { items: [] } }),
          pageBlogPostCollection: vi.fn().mockResolvedValue(mockBlogPostsData),
        },
        previewClient: {
          pageLanding: vi.fn().mockResolvedValue({ pageLandingCollection: { items: [] } }),
          pageBlogPostCollection: vi.fn().mockResolvedValue(mockBlogPostsData),
        },
      });

      await expect(() => BlogPage(defaultProps)).rejects.toThrow("NEXT_NOT_FOUND");
    });

    it("returns early when featured blog post or posts are missing", async () => {
      const dataWithoutFeatured = {
        pageLandingCollection: {
          items: [{ featuredBlogPost: null }],
        },
      };

      mockGetContentfulClients.mockResolvedValueOnce({
        client: {
          pageLanding: vi.fn().mockResolvedValue(dataWithoutFeatured),
          pageBlogPostCollection: vi.fn().mockResolvedValue(mockBlogPostsData),
        },
        previewClient: {
          pageLanding: vi.fn().mockResolvedValue(dataWithoutFeatured),
          pageBlogPostCollection: vi.fn().mockResolvedValue(mockBlogPostsData),
        },
      });

      const result = await BlogPage(defaultProps);

      expect(result).toBeUndefined();
    });

    it("applies correct CSS classes to article grid", async () => {
      render(await BlogPage(defaultProps));

      expect(screen.getByTestId("article-tile-grid")).toHaveClass(
        "md:grid-cols-2",
        "lg:grid-cols-3",
      );
    });
  });
});
