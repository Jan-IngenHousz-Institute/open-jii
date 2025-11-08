import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import FaqPage, { generateMetadata } from "./page";

vi.mock("next/headers", () => ({
  draftMode: vi.fn(() => Promise.resolve({ isEnabled: false })),
}));

const mockPageFaq = vi.fn();

vi.mock("~/lib/contentful", () => ({
  getContentfulClients: vi.fn(() =>
    Promise.resolve({
      client: {
        pageFaq: mockPageFaq,
      },
      previewClient: {
        pageFaq: mockPageFaq,
      },
    }),
  ),
}));

describe("FAQ Page - generateMetadata", () => {
  const mockFaqData = {
    pageTitle: "Frequently Asked Questions",
    pageDescription: "Find answers to common questions",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate metadata from Contentful when data is available", async () => {
    mockPageFaq.mockResolvedValueOnce({
      pageFaqCollection: {
        items: [mockFaqData],
      },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US" as const }),
    });

    expect(metadata).toEqual({
      title: "Frequently Asked Questions",
      description: "Find answers to common questions",
    });
  });

  it("should handle missing pageTitle", async () => {
    mockPageFaq.mockResolvedValueOnce({
      pageFaqCollection: {
        items: [
          {
            pageTitle: null,
            pageDescription: "Find answers to common questions",
          },
        ],
      },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US" as const }),
    });

    expect(metadata.title).toBeUndefined();
    expect(metadata.description).toBe("Find answers to common questions");
  });

  it("should handle missing pageDescription", async () => {
    mockPageFaq.mockResolvedValueOnce({
      pageFaqCollection: {
        items: [
          {
            pageTitle: "Frequently Asked Questions",
            pageDescription: null,
          },
        ],
      },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US" as const }),
    });

    expect(metadata.title).toBe("Frequently Asked Questions");
    expect(metadata.description).toBeUndefined();
  });

  it("should handle both fields being null", async () => {
    mockPageFaq.mockResolvedValueOnce({
      pageFaqCollection: {
        items: [
          {
            pageTitle: null,
            pageDescription: null,
          },
        ],
      },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US" as const }),
    });

    expect(metadata).toEqual({
      title: undefined,
      description: undefined,
    });
  });
});

vi.mock("@repo/cms", () => ({
  FaqContent: ({ faq, locale, preview }: { faq: unknown; locale: string; preview: boolean }) => (
    <div data-testid="faq-content">
      {"FAQ Content - "}
      {locale}
      {" - "}
      {preview ? "preview" : "published"}
      {" - "}
      {faq ? "with data" : "no data"}
    </div>
  ),
}));

describe("FAQ Page - Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders FAQ page with data", async () => {
    const mockFaqData = {
      pageTitle: "FAQ",
      pageDescription: "Frequently Asked Questions",
    };
    
    mockPageFaq.mockResolvedValueOnce({
      pageFaqCollection: {
        items: [mockFaqData],
      },
    });

    render(await FaqPage({ params: Promise.resolve({ locale: "en-US" as const }) }));

    expect(screen.getByTestId("faq-content")).toBeInTheDocument();
    expect(screen.getByTestId("faq-content")).toHaveTextContent(
      "FAQ Content - en-US - published - with data",
    );
  });

  it("renders FAQ page with different locale", async () => {
    const mockFaqData = {
      pageTitle: "FAQ",
      pageDescription: "Häufig gestellte Fragen",
    };
    
    mockPageFaq.mockResolvedValueOnce({
      pageFaqCollection: {
        items: [mockFaqData],
      },
    });

    render(await FaqPage({ params: Promise.resolve({ locale: "de" as const }) }));

    expect(screen.getByTestId("faq-content")).toHaveTextContent(
      "FAQ Content - de - published - with data",
    );
  });

  it("passes correct parameters to getFaqData", async () => {
    const mockFaqData = { pageTitle: "FAQ" };
    
    mockPageFaq.mockResolvedValueOnce({
      pageFaqCollection: {
        items: [mockFaqData],
      },
    });

    await FaqPage({ params: Promise.resolve({ locale: "en-US" as const }) });

    expect(mockPageFaq).toHaveBeenCalledWith({ locale: "en-US", preview: false });
  });
});
