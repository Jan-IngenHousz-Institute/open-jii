import { render, screen } from "@/test/test-utils";
import { draftMode } from "next/headers";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getContentfulClients } from "~/lib/contentful";

import AboutPage, { generateMetadata } from "./page";

const mockPageAbout = vi.fn();

vi.mock("@repo/cms", () => ({
  AboutContent: ({ locale, preview }: { locale: string; preview: boolean }) => (
    <section aria-label="about content">
      {locale}
      {preview ? " preview" : ""}
    </section>
  ),
}));

const aboutData = { pageTitle: "About Us", pageDescription: "Learn about JII." };

describe("AboutPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getContentfulClients).mockResolvedValue({
      client: { pageAbout: mockPageAbout },
      previewClient: { pageAbout: mockPageAbout },
    } as never);
    mockPageAbout.mockResolvedValue({ pageAboutCollection: { items: [aboutData] } });
  });

  const params = { params: Promise.resolve({ locale: "en-US" }) };

  describe("generateMetadata", () => {
    it("returns title and description from CMS", async () => {
      const metadata = await generateMetadata(params);
      expect(metadata).toEqual({ title: "About Us", description: "Learn about JII." });
    });

    it("returns empty metadata when fields are null", async () => {
      mockPageAbout.mockResolvedValue({
        pageAboutCollection: { items: [{ pageTitle: null, pageDescription: null }] },
      });
      const metadata = await generateMetadata(params);
      expect(metadata).toEqual({});
    });
  });

  it("renders AboutContent with locale", async () => {
    const ui = await AboutPage(params);
    render(ui);
    expect(screen.getByRole("region", { name: /about content/i })).toHaveTextContent("en-US");
  });

  it("passes preview flag when draft mode is enabled", async () => {
    vi.mocked(draftMode).mockResolvedValue({ isEnabled: true } as never);
    const ui = await AboutPage(params);
    render(ui);
    expect(screen.getByRole("region", { name: /about content/i })).toHaveTextContent("preview");
  });
});
