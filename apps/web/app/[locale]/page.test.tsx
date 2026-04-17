import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "~/app/actions/auth";

import Home, { generateMetadata } from "./page";

const { mockPageHome } = vi.hoisted(() => ({
  mockPageHome: vi.fn(),
}));
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

vi.mock("@repo/cms", () => ({
  HomeHero: () => <section aria-label="hero" />,
  HomeAboutMission: () => <section aria-label="mission" />,
  HomeKeyFeatures: () => <section aria-label="features" />,
  HomePartners: () => <section aria-label="partners" />,
  HomeFooter: () => <footer aria-label="footer" />,
}));

const contentfulData = {
  pageHomeHeroCollection: { items: [{ title: "Hero" }] },
  pageHomeMissionCollection: { items: [{ title: "Mission" }] },
  pageHomeFeaturesCollection: { items: [{ title: "Features" }] },
  pageHomePartnersCollection: { items: [{ title: "Partners" }] },
  footerCollection: { items: [{ title: "Footer" }] },
  landingMetadataCollection: { items: [{ title: "Page Title", description: "Page desc" }] },
};

const defaultProps = { params: Promise.resolve({ locale: "en-US" }) };

describe("Home page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(null);
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

  it("shows authenticated state in navbar when user is logged in", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", name: "Test" } } as never);
    render(await Home(defaultProps));

    expect(screen.getByText("Logged in")).toBeInTheDocument();
  });

  it("shows unauthenticated state when no session", async () => {
    render(await Home(defaultProps));

    expect(screen.getByText("Not logged in")).toBeInTheDocument();
  });

  it("handles empty Contentful collections", async () => {
    mockPageHome.mockResolvedValue({
      pageHomeHeroCollection: { items: [] },
      pageHomeMissionCollection: { items: [] },
      pageHomeFeaturesCollection: { items: [] },
      pageHomePartnersCollection: { items: [] },
      footerCollection: { items: [] },
      landingMetadataCollection: { items: [] },
    });

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
    expect(metadata.description).toBe("Page desc");
  });

  it("returns undefined when CMS fields are null", async () => {
    mockPageHome.mockResolvedValue({
      ...contentfulData,
      landingMetadataCollection: { items: [{ title: null, description: null }] },
    });

    const metadata = await generateMetadata(defaultProps);

    expect(metadata.title).toBeUndefined();
    expect(metadata.description).toBeUndefined();
  });
});
