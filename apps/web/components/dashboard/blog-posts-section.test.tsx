import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { draftMode } from "next/headers";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BlogPostsSection } from "./blog-posts-section";

globalThis.React = React;

// Mock Next.js draftMode
vi.mock("next/headers", () => ({
  draftMode: vi.fn(),
}));

// Mock Contentful clients
const mockClient = { pageBlogPostCollection: vi.fn() };
const mockPreviewClient = { pageBlogPostCollection: vi.fn() };

vi.mock("~/lib/contentful", () => ({
  getContentfulClients: () =>
    Promise.resolve({
      client: mockClient,
      previewClient: mockPreviewClient,
    }),
}));

// Mock CMS components
vi.mock("@repo/cms/article", () => ({
  ArticleTileGrid: ({ articles, locale }: { articles: unknown[]; locale: string }) => (
    <div data-testid="article-grid">
      count:{articles.length} locale:{locale}
    </div>
  ),
}));

// Helper to create mock items
const createItems = (count: number) => Array.from({ length: count }, (_, i) => ({ id: i + 1 }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(draftMode).mockResolvedValue({
    isEnabled: false,
    enable: vi.fn(),
    disable: vi.fn(),
  });
});

describe("<BlogPostsSection />", () => {
  it("renders ArticleTileGrid when posts exist", async () => {
    mockClient.pageBlogPostCollection.mockResolvedValue({
      pageBlogPostCollection: { items: createItems(2) },
    });

    const ui = await BlogPostsSection({ locale: "en-US" });
    render(ui);

    const grid = await screen.findByTestId("article-grid");
    expect(grid).toHaveTextContent("count:2");
    expect(grid).toHaveTextContent("locale:en-US");
    expect(mockClient.pageBlogPostCollection).toHaveBeenCalledOnce();
    expect(mockPreviewClient.pageBlogPostCollection).not.toHaveBeenCalled();
  });

  it("renders empty state when no posts", async () => {
    mockClient.pageBlogPostCollection.mockResolvedValue({
      pageBlogPostCollection: { items: [] },
    });

    const ui = await BlogPostsSection({ locale: "en-US" });
    render(ui);

    expect(screen.getByText(/No blog posts available/i)).toBeInTheDocument();
  });

  it("renders error state when fetch throws", async () => {
    mockClient.pageBlogPostCollection.mockRejectedValue(new Error("boom"));

    const ui = await BlogPostsSection({ locale: "en-US" });
    render(ui);

    expect(screen.getByText(/Error loading blog posts/i)).toBeInTheDocument();
  });

  it("uses previewClient when draft mode is enabled", async () => {
    vi.mocked(draftMode).mockResolvedValue({
      isEnabled: true,
      enable: vi.fn(),
      disable: vi.fn(),
    });

    mockPreviewClient.pageBlogPostCollection.mockResolvedValue({
      pageBlogPostCollection: { items: createItems(1) },
    });

    const ui = await BlogPostsSection({ locale: "nl-NL" });
    render(ui);

    const grid = await screen.findByTestId("article-grid");
    expect(grid).toHaveTextContent("count:1");
    expect(grid).toHaveTextContent("locale:nl-NL");
    expect(mockPreviewClient.pageBlogPostCollection).toHaveBeenCalledOnce();
    expect(mockClient.pageBlogPostCollection).not.toHaveBeenCalled();
  });
});
