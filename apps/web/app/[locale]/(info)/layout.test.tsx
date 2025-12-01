import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import InfoLayout from "./layout";

globalThis.React = React;

// --- Mocks ---
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: (): unknown => mockAuth(),
}));

vi.mock("next/headers", () => ({
  draftMode: vi.fn(() => Promise.resolve({ isEnabled: false })),
}));

const mockFooterData = {
  sys: { id: "footer-1" },
  title: "Footer",
  socialMediaLinksCollection: { items: [] },
};

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
  HomeFooter: ({
    footerData,
    preview,
    locale,
  }: {
    footerData: unknown;
    preview: boolean;
    locale: string;
  }) => (
    <div data-testid="home-footer">
      Footer - {locale} - {preview ? "preview" : "published"} -{" "}
      {footerData ? "with data" : "no data"}
    </div>
  ),
}));

vi.mock("@repo/cms/contentful", () => ({
  ContentfulPreviewProvider: ({
    children,
    locale,
    enableInspectorMode,
    enableLiveUpdates,
  }: {
    children: React.ReactNode;
    locale: string;
    enableInspectorMode: boolean;
    enableLiveUpdates: boolean;
  }) => (
    <div
      data-testid="contentful-preview-provider"
      data-locale={locale}
      data-inspector={enableInspectorMode}
      data-live={enableLiveUpdates}
    >
      {children}
    </div>
  ),
}));

// --- Tests ---
describe("InfoLayout", () => {
  const locale = "en-US";
  const defaultProps = {
    children: <div data-testid="test-children">Test Content</div>,
    params: Promise.resolve({ locale }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(null);
    mockGetContentfulClients.mockResolvedValue({
      client: {
        footer: vi.fn().mockResolvedValue({
          footerCollection: { items: [mockFooterData] },
        }),
      },
      previewClient: {
        footer: vi.fn().mockResolvedValue({
          footerCollection: { items: [mockFooterData] },
        }),
      },
    });
  });

  it("renders all components with correct structure", async () => {
    render(await InfoLayout(defaultProps));

    expect(screen.getByTestId("contentful-preview-provider")).toBeInTheDocument();
    expect(screen.getByTestId("unified-navbar")).toBeInTheDocument();
    expect(screen.getByTestId("test-children")).toBeInTheDocument();
    expect(screen.getByTestId("home-footer")).toBeInTheDocument();
  });

  it("passes correct locale to components", async () => {
    render(await InfoLayout(defaultProps));

    expect(screen.getByTestId("unified-navbar")).toHaveTextContent("en-US");
    expect(screen.getByTestId("home-footer")).toHaveTextContent("en-US");
    expect(screen.getByTestId("contentful-preview-provider")).toHaveAttribute(
      "data-locale",
      "en-US",
    );
  });

  it("renders without session by default", async () => {
    mockAuth.mockResolvedValue(null);

    render(await InfoLayout(defaultProps));

    expect(screen.getByTestId("unified-navbar")).toHaveTextContent("no session");
  });

  it("renders with session when authenticated", async () => {
    mockAuth.mockResolvedValue({ user: { id: "123", name: "Test User" } });

    render(await InfoLayout(defaultProps));

    expect(screen.getByTestId("unified-navbar")).toHaveTextContent("with session");
  });

  it("uses published client when not in preview mode", async () => {
    render(await InfoLayout(defaultProps));

    expect(screen.getByTestId("home-footer")).toHaveTextContent("published");
    expect(screen.getByTestId("contentful-preview-provider")).toHaveAttribute(
      "data-inspector",
      "false",
    );
    expect(screen.getByTestId("contentful-preview-provider")).toHaveAttribute("data-live", "false");
  });

  it("renders with correct container structure", async () => {
    const { container } = render(await InfoLayout(defaultProps));

    const mainElement = container.querySelector("main");
    expect(mainElement).toBeInTheDocument();
    expect(mainElement).toHaveClass(
      "flex",
      "min-h-screen",
      "w-full",
      "flex-col",
      "px-4",
      "pb-24",
      "pt-8",
    );

    const wrapperDiv = mainElement?.parentElement;
    expect(wrapperDiv).toHaveClass("mx-auto", "flex", "w-full", "max-w-7xl", "justify-center");
  });
});
