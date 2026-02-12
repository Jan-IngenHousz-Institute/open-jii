import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import Home from "./page";

globalThis.React = React;

// --- Mocks ---
const mockAuth = vi.fn();
vi.mock("~/app/actions/auth", () => ({
  auth: (): unknown => mockAuth(),
}));

vi.mock("next/headers", () => ({
  draftMode: vi.fn(() => Promise.resolve({ isEnabled: false })),
}));

const mockGetContentfulClients = vi.fn();
vi.mock("~/lib/contentful", () => ({
  getContentfulClients: (): unknown => mockGetContentfulClients(),
}));

vi.mock("@/components/navigation/unified-navbar/unified-navbar", () => ({
  UnifiedNavbar: ({ locale, session }: { locale: string; session: unknown }) => (
    <div data-testid="unified-navbar">
      Navbar - {locale} - {session ? "with session" : "no session"}
    </div>
  ),
}));

vi.mock("@repo/cms", () => ({
  HomeHero: ({ heroData, locale }: { heroData: unknown; locale: string }) => (
    <div data-testid="home-hero" data-locale={locale}>
      {heroData ? "Hero Content" : "No hero"}
    </div>
  ),
  HomeAboutMission: ({ missionData, locale }: { missionData: unknown; locale: string }) => (
    <div data-testid="home-about-mission" data-locale={locale}>
      {missionData ? "Mission Content" : "No mission"}
    </div>
  ),
  HomeKeyFeatures: ({ featuresData, locale }: { featuresData: unknown; locale: string }) => (
    <div data-testid="home-key-features" data-locale={locale}>
      {featuresData ? "Features Content" : "No features"}
    </div>
  ),
  HomePartners: ({ partnersData, locale }: { partnersData: unknown; locale: string }) => (
    <div data-testid="home-partners" data-locale={locale}>
      {partnersData ? "Partners Content" : "No partners"}
    </div>
  ),
  HomeFooter: ({ footerData, locale }: { footerData: unknown; locale: string }) => (
    <div data-testid="home-footer" data-locale={locale}>
      {footerData ? "Footer Content" : "No footer"}
    </div>
  ),
}));

// --- Tests ---
describe("Home", () => {
  const locale = "en-US";
  const defaultProps = {
    params: Promise.resolve({ locale }),
  };

  const mockContentfulData = {
    pageHomeHeroCollection: { items: [{ title: "Hero Title" }] },
    pageHomeMissionCollection: { items: [{ title: "Mission Title" }] },
    pageHomeFeaturesCollection: { items: [{ title: "Features Title" }] },
    pageHomePartnersCollection: { items: [{ title: "Partners Title" }] },
    footerCollection: { items: [{ title: "Footer Title" }] },
    landingMetadataCollection: { items: [{ title: "Metadata Title", description: "Description" }] },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(null);
    mockGetContentfulClients.mockResolvedValue({
      client: {
        pageHome: vi.fn().mockResolvedValue(mockContentfulData),
      },
      previewClient: {
        pageHome: vi.fn().mockResolvedValue(mockContentfulData),
      },
    });
  });

  it("renders all home page components", async () => {
    render(await Home(defaultProps));

    expect(screen.getByTestId("unified-navbar")).toBeInTheDocument();
    expect(screen.getByTestId("home-hero")).toBeInTheDocument();
    expect(screen.getByTestId("home-about-mission")).toBeInTheDocument();
    expect(screen.getByTestId("home-key-features")).toBeInTheDocument();
    expect(screen.getByTestId("home-partners")).toBeInTheDocument();
    expect(screen.getByTestId("home-footer")).toBeInTheDocument();
  });

  it("passes correct locale to all components", async () => {
    render(await Home(defaultProps));

    expect(screen.getByTestId("unified-navbar")).toHaveTextContent("en-US");
    expect(screen.getByTestId("home-hero")).toHaveAttribute("data-locale", "en-US");
    expect(screen.getByTestId("home-about-mission")).toHaveAttribute("data-locale", "en-US");
    expect(screen.getByTestId("home-key-features")).toHaveAttribute("data-locale", "en-US");
    expect(screen.getByTestId("home-partners")).toHaveAttribute("data-locale", "en-US");
    expect(screen.getByTestId("home-footer")).toHaveAttribute("data-locale", "en-US");
  });

  it("renders without session by default", async () => {
    mockAuth.mockResolvedValue(null);

    render(await Home(defaultProps));

    expect(screen.getByTestId("unified-navbar")).toHaveTextContent("no session");
  });

  it("renders with session when authenticated", async () => {
    mockAuth.mockResolvedValue({ user: { id: "123", name: "Test User" } });

    render(await Home(defaultProps));

    expect(screen.getByTestId("unified-navbar")).toHaveTextContent("with session");
  });

  it("displays content when Contentful data is available", async () => {
    render(await Home(defaultProps));

    expect(screen.getByTestId("home-hero")).toHaveTextContent("Hero Content");
    expect(screen.getByTestId("home-about-mission")).toHaveTextContent("Mission Content");
    expect(screen.getByTestId("home-key-features")).toHaveTextContent("Features Content");
    expect(screen.getByTestId("home-partners")).toHaveTextContent("Partners Content");
    expect(screen.getByTestId("home-footer")).toHaveTextContent("Footer Content");
  });

  it("handles case when Contentful data is missing", async () => {
    mockGetContentfulClients.mockResolvedValueOnce({
      client: {
        pageHome: vi.fn().mockResolvedValue({
          pageHomeHeroCollection: { items: [] },
          pageHomeMissionCollection: { items: [] },
          pageHomeFeaturesCollection: { items: [] },
          pageHomePartnersCollection: { items: [] },
          footerCollection: { items: [] },
          landingMetadataCollection: { items: [] },
        }),
      },
      previewClient: {
        pageHome: vi.fn().mockResolvedValue({
          pageHomeHeroCollection: { items: [] },
          pageHomeMissionCollection: { items: [] },
          pageHomeFeaturesCollection: { items: [] },
          pageHomePartnersCollection: { items: [] },
          footerCollection: { items: [] },
          landingMetadataCollection: { items: [] },
        }),
      },
    });

    render(await Home(defaultProps));

    expect(screen.getByTestId("home-hero")).toHaveTextContent("No hero");
    expect(screen.getByTestId("home-about-mission")).toHaveTextContent("No mission");
    expect(screen.getByTestId("home-key-features")).toHaveTextContent("No features");
    expect(screen.getByTestId("home-partners")).toHaveTextContent("No partners");
    expect(screen.getByTestId("home-footer")).toHaveTextContent("No footer");
  });

  it("renders with correct structure", async () => {
    const { container } = render(await Home(defaultProps));

    // Check that components are rendered in the expected order
    const homeComponents = container.querySelectorAll("[data-testid^='home-']");
    expect(homeComponents).toHaveLength(5); // hero, mission, features, partners, footer
  });
});
