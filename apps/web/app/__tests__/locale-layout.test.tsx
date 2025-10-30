import "@testing-library/jest-dom";
import { render } from "@testing-library/react";
import React from "react";
import { vi, describe, it, expect } from "vitest";

import LocaleLayout, { generateMetadata } from "../[locale]/layout";

// Mock env variables first - must be before imports
vi.mock("~/env", () => ({
  env: {
    NODE_ENV: "test",
    NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
    NEXT_PUBLIC_ENABLE_DEVTOOLS: "false",
  },
}));

// Mock Next.js fonts
vi.mock("next/font/google", () => ({
  Poppins: () => ({
    className: "font-poppins",
    style: {},
    variable: "--font-poppins",
  }),
  Overpass: () => ({
    className: "font-overpass",
    style: {},
    variable: "--font-overpass",
  }),
  Inter: () => ({
    className: "font-inter",
    style: {},
    variable: "--font-inter",
  }),
  Noto_Sans: () => ({
    className: "font-noto-sans",
    style: {},
    variable: "--font-noto-sans",
  }),
}));

vi.mock("next/headers", () => ({
  draftMode: vi.fn(() => ({ isEnabled: false })),
}));

const mockLandingMetadata = vi.fn();

vi.mock("~/lib/contentful", () => ({
  getContentfulClients: vi.fn(() =>
    Promise.resolve({
      client: {
        landingMetadata: mockLandingMetadata,
      },
      previewClient: {
        landingMetadata: mockLandingMetadata,
      },
    }),
  ),
}));

vi.mock("@repo/i18n/server", () => ({
  default: () => Promise.resolve({ t: (key: string) => key }),
}));

describe("LocaleLayout Component", () => {
  const mockProps = {
    children: <div>Test Content</div>,
    params: Promise.resolve({ locale: "en-US" as const }),
  };

  it("should render without crashing", async () => {
    const { container } = render(await LocaleLayout(mockProps));
    expect(container).toBeInTheDocument();
  });

  it("should handle different locales", async () => {
    const propsWithDifferentLocale = {
      children: <div>Test Content</div>,
      params: Promise.resolve({ locale: "de-DE" as const }),
    };
    const { container } = render(await LocaleLayout(propsWithDifferentLocale));
    expect(container).toBeInTheDocument();
  });

  it("should render basic structure", async () => {
    const result = render(await LocaleLayout(mockProps));
    expect(result.container.firstChild).toBeTruthy();
  });
});

describe("generateMetadata", () => {
  it("should generate metadata from Contentful when data is available", async () => {
    mockLandingMetadata.mockResolvedValueOnce({
      landingMetadataCollection: {
        items: [
          {
            title: "CMS Title",
            description: "CMS Description",
          },
        ],
      },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US" as const }),
    });

    expect(metadata).toEqual({
      title: "CMS Title",
      description: "CMS Description",
    });
  });

  it("should use fallback values when Contentful query fails", async () => {
    mockLandingMetadata.mockRejectedValueOnce(new Error("Network error"));

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US" as const }),
    });

    expect(metadata).toEqual({
      title: "openJII",
      description: "jii.aboutDescription",
    });
  });
});
