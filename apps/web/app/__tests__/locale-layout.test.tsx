import { render, screen } from "@/test/test-utils";
import { notFound } from "next/navigation";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Poppins: () => ({ variable: "--font-poppins" }),
  Overpass: () => ({ variable: "--font-overpass" }),
  Inter: () => ({ variable: "--font-inter" }),
  Noto_Sans: () => ({ variable: "--font-noto-sans" }),
}));

vi.mock("~/lib/posthog-server", () => ({
  isFeatureFlagEnabled: vi.fn().mockResolvedValue(true),
}));

vi.mock("@repo/cms/contentful", () => ({
  ContentfulPreviewProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/translations-provider", () => ({
  TranslationsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../hooks/usePostHogAuth", () => ({
  PostHogIdentifier: () => null,
}));

vi.mock("../../providers/QueryProvider", () => ({
  QueryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("LocaleLayout", () => {
  it("renders children within providers", async () => {
    const { default: Layout } = await import("../[locale]/layout");
    const ui = await Layout({
      children: <div>Content</div>,
      params: Promise.resolve({ locale: "en-US" }),
    });
    render(ui);
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("calls notFound for non-default locale when multi-language is disabled", async () => {
    const mod = await import("~/lib/posthog-server");
    vi.mocked(mod.isFeatureFlagEnabled).mockResolvedValue(false);
    const { default: Layout } = await import("../[locale]/layout");
    await Layout({
      children: <div />,
      params: Promise.resolve({ locale: "de-DE" }),
    }).catch(() => {});
    expect(notFound).toHaveBeenCalled();
  });
});
