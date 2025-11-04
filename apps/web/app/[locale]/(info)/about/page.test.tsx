import "@testing-library/jest-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { generateMetadata } from "./page";

vi.mock("next/headers", () => ({
  draftMode: vi.fn(() => Promise.resolve({ isEnabled: false })),
}));

const mockPageAbout = vi.fn();

vi.mock("~/lib/contentful", () => ({
  getContentfulClients: vi.fn(() =>
    Promise.resolve({
      client: {
        pageAbout: mockPageAbout,
      },
      previewClient: {
        pageAbout: mockPageAbout,
      },
    }),
  ),
}));

describe("About Page - generateMetadata", () => {
  const mockAboutData = {
    pageTitle: "About Us",
    pageDescription: "Learn more about our organization",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate metadata from Contentful when data is available", async () => {
    mockPageAbout.mockResolvedValueOnce({
      pageAboutCollection: {
        items: [mockAboutData],
      },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US" as const }),
    });

    expect(metadata).toEqual({
      title: "About Us",
      description: "Learn more about our organization",
    });
  });

  it("should handle missing pageTitle", async () => {
    mockPageAbout.mockResolvedValueOnce({
      pageAboutCollection: {
        items: [
          {
            pageTitle: null,
            pageDescription: "Learn more about our organization",
          },
        ],
      },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US" as const }),
    });

    expect(metadata.title).toBeUndefined();
    expect(metadata.description).toBe("Learn more about our organization");
  });

  it("should handle missing pageDescription", async () => {
    mockPageAbout.mockResolvedValueOnce({
      pageAboutCollection: {
        items: [
          {
            pageTitle: "About Us",
            pageDescription: null,
          },
        ],
      },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US" as const }),
    });

    expect(metadata.title).toBe("About Us");
    expect(metadata.description).toBeUndefined();
  });

  it("should handle both fields being null", async () => {
    mockPageAbout.mockResolvedValueOnce({
      pageAboutCollection: {
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
