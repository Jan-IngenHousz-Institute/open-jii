import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import AboutPage, { generateMetadata } from "./page";

const mockDraftMode = vi.fn(() => Promise.resolve({ isEnabled: false }));
vi.mock("next/headers", () => ({
  draftMode: () => mockDraftMode(),
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

vi.mock("@repo/cms", () => ({
  AboutContent: ({
    about,
    locale,
    preview,
  }: {
    about: unknown;
    locale: string;
    preview: boolean;
  }) => (
    <div data-testid="about-content">
      {"About Content - "}
      {locale}
      {" - "}
      {preview ? "preview" : "published"}
      {" - "}
      {about ? "with data" : "no data"}
    </div>
  ),
}));

describe("About Page - Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDraftMode.mockResolvedValue({ isEnabled: false });
  });

  it("renders about page with data", async () => {
    const mockAboutData = {
      pageTitle: "About Us",
      pageDescription: "Learn more about our organization",
    };

    mockPageAbout.mockResolvedValueOnce({
      pageAboutCollection: {
        items: [mockAboutData],
      },
    });

    render(await AboutPage({ params: Promise.resolve({ locale: "en-US" as const }) }));

    expect(screen.getByTestId("about-content")).toBeInTheDocument();
    expect(screen.getByTestId("about-content")).toHaveTextContent(
      "About Content - en-US - published - with data",
    );
  });

  it("renders about page in preview mode", async () => {
    const mockAboutData = {
      pageTitle: "About Us",
      pageDescription: "Learn more about our organization",
    };

    mockPageAbout.mockResolvedValueOnce({
      pageAboutCollection: {
        items: [mockAboutData],
      },
    });

    // Mock draftMode to return enabled for this test
    mockDraftMode.mockResolvedValueOnce({ isEnabled: true });

    render(await AboutPage({ params: Promise.resolve({ locale: "en-US" as const }) }));

    expect(screen.getByTestId("about-content")).toHaveTextContent(
      "About Content - en-US - preview - with data",
    );
  });

  it("renders about page with different locale", async () => {
    const mockAboutData = {
      pageTitle: "Über uns",
      pageDescription: "Erfahren Sie mehr über unsere Organisation",
    };

    mockPageAbout.mockResolvedValueOnce({
      pageAboutCollection: {
        items: [mockAboutData],
      },
    });

    render(await AboutPage({ params: Promise.resolve({ locale: "de" as const }) }));

    expect(screen.getByTestId("about-content")).toHaveTextContent(
      "About Content - de - published - with data",
    );
  });

  it("passes correct parameters to getAboutData", async () => {
    const mockAboutData = { pageTitle: "About Us" };

    mockPageAbout.mockResolvedValueOnce({
      pageAboutCollection: {
        items: [mockAboutData],
      },
    });

    await AboutPage({ params: Promise.resolve({ locale: "en-US" as const }) });

    expect(mockPageAbout).toHaveBeenCalledWith({ locale: "en-US", preview: false });
  });
});
