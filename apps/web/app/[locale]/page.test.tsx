/**
 * Home page test — tests the Server Component that fetches CMS data
 * and composes the landing page.
 *
 * CMS child components (@repo/cms) are mocked since they have their
 * own rendering logic and Contentful dependencies. The navbar is also
 * mocked since it's tested separately.
 *
 * What we test here:
 * - Page renders all expected sections
 * - Authenticated vs unauthenticated navbar state
 * - Resilience when CMS returns empty data
 * - Metadata generation
 *
 * Global mocks (next/headers, i18n, etc.) come from test/setup.ts.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import Home, { generateMetadata } from "./page";

// ── Mocks specific to this page ────────────────────────────────

const mockAuth = vi.fn();
vi.mock("~/app/actions/auth", () => ({
  auth: () => mockAuth(),
}));

const mockPageHome = vi.fn();
vi.mock("~/lib/contentful", () => ({
  getContentfulClients: () =>
    Promise.resolve({
      client: { pageHome: mockPageHome },
      previewClient: { pageHome: mockPageHome },
    }),
}));

vi.mock("@/components/navigation/unified-navbar/unified-navbar", () => ({
  UnifiedNavbar: ({ session }: { session: unknown }) => (
    <nav aria-label="main navigation">{session ? "Logged in" : "Not logged in"}</nav>
  ),
}));

// CMS section components — render a landmark so we can find them
vi.mock("@repo/cms", () => ({
  HomeHero: () => <section aria-label="hero" />,
  HomeAboutMission: () => <section aria-label="mission" />,
  HomeKeyFeatures: () => <section aria-label="features" />,
  HomePartners: () => <section aria-label="partners" />,
  HomeFooter: () => <footer aria-label="footer" />,
}));

// ── Fixtures ────────────────────────────────────────────────────

const contentfulData = {
  pageHomeHeroCollection: { items: [{ title: "Hero" }] },
  pageHomeMissionCollection: { items: [{ title: "Mission" }] },
  pageHomeFeaturesCollection: { items: [{ title: "Features" }] },
  pageHomePartnersCollection: { items: [{ title: "Partners" }] },
  footerCollection: { items: [{ title: "Footer" }] },
  landingMetadataCollection: { items: [{ title: "Page Title", description: "Page description" }] },
};

const emptyContentfulData = {
  pageHomeHeroCollection: { items: [] },
  pageHomeMissionCollection: { items: [] },
  pageHomeFeaturesCollection: { items: [] },
  pageHomePartnersCollection: { items: [] },
  footerCollection: { items: [] },
  landingMetadataCollection: { items: [] },
};

const defaultProps = { params: Promise.resolve({ locale: "en-US" }) };

// ── Tests ───────────────────────────────────────────────────────

describe("Home page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(null);
    mockPageHome.mockResolvedValue(contentfulData);
  });

  it("renders all CMS sections and the navbar", async () => {
    render(await Home(defaultProps));

    expect(screen.getByRole("navigation", { name: /main navigation/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /hero/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /mission/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /features/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /partners/i })).toBeInTheDocument();
    expect(screen.getByRole("contentinfo", { name: /footer/i })).toBeInTheDocument();
  });

  it("shows 'Not logged in' for unauthenticated visitors", async () => {
    mockAuth.mockResolvedValue(null);

    render(await Home(defaultProps));

    expect(screen.getByText("Not logged in")).toBeInTheDocument();
  });

  it("shows 'Logged in' for authenticated users", async () => {
    mockAuth.mockResolvedValue({ user: { id: "123", name: "Test" } });

    render(await Home(defaultProps));

    expect(screen.getByText("Logged in")).toBeInTheDocument();
  });

  it("still renders when Contentful returns empty collections", async () => {
    mockPageHome.mockResolvedValue(emptyContentfulData);

    // Should not throw
    render(await Home(defaultProps));

    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });
});

describe("generateMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPageHome.mockResolvedValue(contentfulData);
  });

  it("returns title and description from Contentful", async () => {
    const metadata = await generateMetadata(defaultProps);

    expect(metadata.title).toBe("Page Title");
    expect(metadata.description).toBe("Page description");
  });

  it("returns empty metadata when CMS fields are null", async () => {
    mockPageHome.mockResolvedValue({
      ...contentfulData,
      landingMetadataCollection: { items: [{ title: null, description: null }] },
    });

    const metadata = await generateMetadata(defaultProps);

    expect(metadata.title).toBeUndefined();
    expect(metadata.description).toBeUndefined();
  });
});
