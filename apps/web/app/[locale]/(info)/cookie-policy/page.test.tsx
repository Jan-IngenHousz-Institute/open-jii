import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import CookiePolicyPage, { generateMetadata } from "./page";

globalThis.React = React;

// --- Mocks ---
const mockDraftMode = vi.fn(() => Promise.resolve({ isEnabled: false }));
vi.mock("next/headers", () => ({
  draftMode: () => mockDraftMode(),
}));

const mockPageCookiePolicy = vi.fn();

vi.mock("~/lib/contentful", () => ({
  getContentfulClients: vi.fn(() =>
    Promise.resolve({
      client: {
        pageCookiePolicy: mockPageCookiePolicy,
      },
      previewClient: {
        pageCookiePolicy: mockPageCookiePolicy,
      },
    }),
  ),
}));

vi.mock("@repo/cms", () => ({
  CookiePolicyContent: ({
    cookiePolicy,
    locale,
    preview,
  }: {
    cookiePolicy: unknown;
    locale: string;
    preview: boolean;
  }) => (
    <div data-testid="cookie-policy-content">
      {"Cookie Policy Content - "}
      {locale}
      {" - "}
      {preview ? "preview" : "published"}
      {" - "}
      {cookiePolicy ? "with data" : "no data"}
    </div>
  ),
}));

describe("Cookie Policy Page - generateMetadata", () => {
  const mockCookiePolicyData = {
    pageTitle: "Cookie Policy",
    pageDescription: "Learn about our cookie usage and privacy practices",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate metadata from Contentful when data is available", async () => {
    mockPageCookiePolicy.mockResolvedValueOnce({
      pageCookiePolicyCollection: {
        items: [mockCookiePolicyData],
      },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US" }),
    });

    expect(metadata).toEqual({
      title: "Cookie Policy",
      description: "Learn about our cookie usage and privacy practices",
    });
  });

  it("should handle missing pageTitle", async () => {
    mockPageCookiePolicy.mockResolvedValueOnce({
      pageCookiePolicyCollection: {
        items: [
          {
            pageTitle: null,
            pageDescription: "Learn about our cookie usage and privacy practices",
          },
        ],
      },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US" }),
    });

    expect(metadata.title).toBeUndefined();
    expect(metadata.description).toBe("Learn about our cookie usage and privacy practices");
  });

  it("should handle missing pageDescription", async () => {
    mockPageCookiePolicy.mockResolvedValueOnce({
      pageCookiePolicyCollection: {
        items: [
          {
            pageTitle: "Cookie Policy",
            pageDescription: null,
          },
        ],
      },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US" }),
    });

    expect(metadata.title).toBe("Cookie Policy");
    expect(metadata.description).toBeUndefined();
  });

  it("should handle both fields being null", async () => {
    mockPageCookiePolicy.mockResolvedValueOnce({
      pageCookiePolicyCollection: {
        items: [
          {
            pageTitle: null,
            pageDescription: null,
          },
        ],
      },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US" }),
    });

    expect(metadata).toEqual({
      title: undefined,
      description: undefined,
    });
  });
});

describe("Cookie Policy Page - Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDraftMode.mockResolvedValue({ isEnabled: false });
  });

  it("renders cookie policy page with data", async () => {
    const mockCookiePolicyData = {
      pageTitle: "Cookie Policy",
      pageDescription: "Learn about our cookie usage and privacy practices",
    };

    mockPageCookiePolicy.mockResolvedValueOnce({
      pageCookiePolicyCollection: {
        items: [mockCookiePolicyData],
      },
    });

    render(
      await CookiePolicyPage({
        params: Promise.resolve({ locale: "en-US" as const }),
      }),
    );

    expect(screen.getByTestId("cookie-policy-content")).toBeInTheDocument();
    expect(screen.getByTestId("cookie-policy-content")).toHaveTextContent(
      "Cookie Policy Content - en-US - published - with data",
    );
  });

  it("renders cookie policy page with different locale", async () => {
    const mockCookiePolicyData = {
      pageTitle: "Cookie-Richtlinie",
      pageDescription: "Erfahren Sie mehr über unsere Cookie-Nutzung",
    };

    mockPageCookiePolicy.mockResolvedValueOnce({
      pageCookiePolicyCollection: {
        items: [mockCookiePolicyData],
      },
    });

    render(await CookiePolicyPage({ params: Promise.resolve({ locale: "de-DE" as const }) }));

    expect(screen.getByTestId("cookie-policy-content")).toHaveTextContent(
      "Cookie Policy Content - de-DE - published - with data",
    );
  });

  it("passes correct parameters to getCookiePolicyData", async () => {
    const mockCookiePolicyData = { pageTitle: "Cookie Policy" };

    mockPageCookiePolicy.mockResolvedValueOnce({
      pageCookiePolicyCollection: {
        items: [mockCookiePolicyData],
      },
    });

    await CookiePolicyPage({ params: Promise.resolve({ locale: "en-US" as const }) });

    expect(mockPageCookiePolicy).toHaveBeenCalledWith({ locale: "en-US", preview: false });
  });

  it("renders cookie policy page in preview mode", async () => {
    const mockCookiePolicyData = {
      pageTitle: "Cookie Policy",
      pageDescription: "Learn about our cookie usage and privacy practices",
    };

    mockPageCookiePolicy.mockResolvedValueOnce({
      pageCookiePolicyCollection: {
        items: [mockCookiePolicyData],
      },
    });

    // Mock draftMode to return enabled for this test
    mockDraftMode.mockResolvedValueOnce({ isEnabled: true });

    render(
      await CookiePolicyPage({
        params: Promise.resolve({ locale: "en-US" as const }),
      }),
    );

    expect(screen.getByTestId("cookie-policy-content")).toHaveTextContent(
      "Cookie Policy Content - en-US - preview - with data",
    );
  });
});
