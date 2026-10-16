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

describe("BlogPostsSection", () => {
  it("renders each post as a tile with its date, under a heading that links to the blog", async () => {
    mockGqlClient.pageBlogPostCollection.mockResolvedValue({
      pageBlogPostCollection: {
        items: [
          {
            sys: { id: "1" },
            slug: "spring",
            title: "What's new this spring",
            // Midnight in Amsterdam is the evening before in UTC; the tile keeps the entered day.
            publishedDate: "2026-06-22T00:00:00.000+02:00",
            featuredImage: null,
          },
          {
            sys: { id: "2" },
            slug: "hackathon",
            title: "Reflection on the hackathon",
            publishedDate: "2026-03-30T00:00:00.000Z",
            featuredImage: null,
          },
        ],
      },
    });

    const section = await BlogPostsSection({ locale: "en-US" });
    if (!section) throw new Error("Expected the section to render");
    render(section);

    expect(screen.getByRole("heading", { name: "dashboard.recentArticles" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /What's new this spring/ })).toHaveAttribute(
      "href",
      "/en-US/blog/spring",
    );
    expect(screen.getByText("June 22, 2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Reflection on the hackathon/ })).toBeInTheDocument();
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
