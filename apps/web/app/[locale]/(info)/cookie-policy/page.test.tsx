import { render, screen } from "@/test/test-utils";
import { draftMode } from "next/headers";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getContentfulClients } from "~/lib/contentful";

import Page, { generateMetadata } from "./page";

const mockPageCookiePolicy = vi.fn();

vi.mock("@repo/cms", () => ({
  CookiePolicyContent: ({ locale, preview }: { locale: string; preview: boolean }) => (
    <section aria-label="cookie policy">
      {locale}
      {preview ? " preview" : ""}
    </section>
  ),
}));

const policyData = { pageTitle: "Cookie Policy", pageDescription: "How we use cookies." };

describe("CookiePolicyPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getContentfulClients).mockResolvedValue({
      client: { pageCookiePolicy: mockPageCookiePolicy },
      previewClient: { pageCookiePolicy: mockPageCookiePolicy },
    } as never);
    mockPageCookiePolicy.mockResolvedValue({
      pageCookiePolicyCollection: { items: [policyData] },
    });
  });

  const params = { params: Promise.resolve({ locale: "en-US" }) };

  describe("generateMetadata", () => {
    it("returns title and description from CMS", async () => {
      const metadata = await generateMetadata(params);
      expect(metadata).toEqual({ title: "Cookie Policy", description: "How we use cookies." });
    });

    it("returns empty metadata when fields are null", async () => {
      mockPageCookiePolicy.mockResolvedValue({
        pageCookiePolicyCollection: { items: [{ pageTitle: null, pageDescription: null }] },
      });
      const metadata = await generateMetadata(params);
      expect(metadata).toEqual({});
    });
  });

  it("renders CookiePolicyContent with locale", async () => {
    const ui = await Page(params);
    render(ui);
    expect(screen.getByRole("region", { name: /cookie policy/i })).toHaveTextContent("en-US");
  });

  it("passes preview flag when draft mode is enabled", async () => {
    vi.mocked(draftMode).mockResolvedValue({ isEnabled: true } as never);
    const ui = await Page(params);
    render(ui);
    expect(screen.getByRole("region", { name: /cookie policy/i })).toHaveTextContent("preview");
  });
});
