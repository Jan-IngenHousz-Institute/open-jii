import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { Locale } from "@repo/i18n";

import { AuthHeroSection } from "./auth-hero-section";

globalThis.React = React;

// --- Mocks ---
vi.mock("@repo/i18n/server", () => ({
  default: vi.fn(() =>
    Promise.resolve({
      t: (key: string) => key,
    }),
  ),
}));

describe("AuthHeroSection", () => {
  const locale = "en-US" as Locale;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the hero title", async () => {
    render(await AuthHeroSection({ locale }));

    expect(screen.getByText("auth.heroTitle")).toBeInTheDocument();
  });

  it("renders the hero description", async () => {
    render(await AuthHeroSection({ locale }));

    expect(screen.getByText("auth.heroDescription")).toBeInTheDocument();
  });

  it("renders brand name and powered by text", async () => {
    render(await AuthHeroSection({ locale }));

    expect(screen.getByText("auth.brandName")).toBeInTheDocument();
    expect(screen.getByText("auth.poweredBy")).toBeInTheDocument();
  });

  it("renders the institute logo with correct alt text", async () => {
    render(await AuthHeroSection({ locale }));

    const logo = screen.getByAltText("auth.instituteAlt");
    expect(logo).toBeInTheDocument();

    const src = logo.getAttribute("src") ?? "";

    // decode %2F back into "/" so we can assert the filename is present
    expect(decodeURIComponent(src)).toContain("/jan-ingenhousz-institute-logo-header-light.png");

    expect(logo).toHaveAttribute("width", "140");
    expect(logo).toHaveAttribute("height", "28");
  });
});
