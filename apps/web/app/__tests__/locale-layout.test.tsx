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
}));

// Mock translations provider
vi.mock("@/components/translations-provider", () => ({
  TranslationsProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock all modules that might use env
vi.mock("../../env", () => ({
  env: {
    NODE_ENV: "test",
    NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
    NEXT_PUBLIC_ENABLE_DEVTOOLS: "false",
  },
}));

vi.mock("../providers/QueryProvider", () => ({
  QueryProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("next/headers", () => ({
  draftMode: vi.fn(() => ({ isEnabled: false })),
}));

vi.mock("@repo/i18n/server", () => ({
  default: () => Promise.resolve({ t: (key: string) => key, resources: {} }),
}));

vi.mock("@repo/cms", () => ({
  ContentfulProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@repo/i18n/client", () => ({
  TranslationsProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@repo/auth/client", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@repo/cms/contentful", () => ({
  ContentfulPreviewProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

  it("should generate metadata correctly", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US" as const }),
    });
    expect(metadata).toBeDefined();
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
