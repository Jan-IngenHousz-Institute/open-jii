import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import FaqPage, { generateMetadata } from "./page";

const mockPageFaq = vi.fn();
vi.mock("~/lib/contentful", () => ({
  getContentfulClients: () =>
    Promise.resolve({
      client: { pageFaq: mockPageFaq },
      previewClient: { pageFaq: mockPageFaq },
    }),
}));

vi.mock("@repo/cms", () => ({
  FaqContent: ({ locale }: { locale: string }) => (
    <div data-testid="faq-content">FAQ - {locale}</div>
  ),
}));

const faqData = {
  pageTitle: "Frequently Asked Questions",
  pageDescription: "Find answers to common questions",
};

const defaultProps = { params: Promise.resolve({ locale: "en-US" as const }) };

describe("FaqPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPageFaq.mockResolvedValue({ pageFaqCollection: { items: [faqData] } });
  });

  it("generates metadata from Contentful", async () => {
    const metadata = await generateMetadata(defaultProps);

    expect(metadata).toEqual({
      title: "Frequently Asked Questions",
      description: "Find answers to common questions",
    });
  });

  it("omits null metadata fields", async () => {
    mockPageFaq.mockResolvedValue({
      pageFaqCollection: { items: [{ pageTitle: null, pageDescription: null }] },
    });

    const metadata = await generateMetadata(defaultProps);

    expect(metadata.title).toBeUndefined();
    expect(metadata.description).toBeUndefined();
  });

  it("renders FaqContent with locale", async () => {
    render(await FaqPage(defaultProps));

    expect(screen.getByTestId("faq-content")).toHaveTextContent("FAQ - en-US");
  });

  it("passes correct locale and preview params to Contentful", async () => {
    await FaqPage(defaultProps);

    expect(mockPageFaq).toHaveBeenCalledWith({ locale: "en-US", preview: false });
  });
});
