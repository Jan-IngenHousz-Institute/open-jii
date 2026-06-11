import * as posthogServer from "@/shared/analytics/posthog-server";
import { render, screen } from "@/test/test-utils";
import { notFound } from "next/navigation";
import { describe, it, expect, vi } from "vitest";

import Layout from "../[locale]/layout";

vi.mock("next/font/google", () => ({
  Poppins: () => ({ variable: "--font-poppins" }),
  Overpass: () => ({ variable: "--font-overpass" }),
  Inter: () => ({ variable: "--font-inter" }),
  Noto_Sans: () => ({ variable: "--font-noto-sans" }),
}));

vi.mock("@/shared/analytics/posthog-server", () => ({
  isFeatureFlagEnabled: vi.fn().mockResolvedValue(true),
}));

vi.mock("@repo/cms/contentful", () => ({
  ContentfulPreviewProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/shared/i18n/translations-provider", () => ({
  TranslationsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/shared/analytics/usePostHogAuth", () => ({
  PostHogIdentifier: () => null,
}));

vi.mock("@/shared/providers/QueryProvider", () => ({
  QueryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/shared/ui/alerts-bar", () => ({
  AlertsBar: () => null,
}));

describe("LocaleLayout", () => {
  it("renders children within providers", async () => {
    const ui = await Layout({
      children: <div>Content</div>,
      params: Promise.resolve({ locale: "en-US" }),
    });
    render(ui);
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("calls notFound for non-default locale when multi-language is disabled", async () => {
    vi.mocked(posthogServer.isFeatureFlagEnabled).mockResolvedValue(false);
    await Layout({
      children: <div />,
      params: Promise.resolve({ locale: "de-DE" }),
    }).catch(() => undefined);
    expect(notFound).toHaveBeenCalled();
  });
});
