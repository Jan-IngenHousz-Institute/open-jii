import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import TermsAndConditionsPageRoute, { generateMetadata } from "./page";

vi.mock("next/headers", () => ({
  draftMode: vi.fn(() => Promise.resolve({ isEnabled: false })),
}));

const mockPageTermsAndConditions = vi.fn();

vi.mock("~/lib/contentful", () => ({
  getContentfulClients: vi.fn(() =>
    Promise.resolve({
      client: {
        pageTermsAndConditions: mockPageTermsAndConditions,
      },
      previewClient: {
        pageTermsAndConditions: mockPageTermsAndConditions,
      },
    }),
  ),
}));

describe("Terms and Conditions Page - generateMetadata", () => {
  const mockTermsAndConditionsData = {
    pageTitle: "Terms and Conditions",
    pageDescription: "Read our terms and conditions of service",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate metadata from Contentful when data is available", async () => {
    mockPageTermsAndConditions.mockResolvedValueOnce({
      pageTermsAndConditionsCollection: {
        items: [mockTermsAndConditionsData],
      },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US" as const }),
    });

    expect(metadata).toEqual({
      title: "Terms and Conditions",
      description: "Read our terms and conditions of service",
    });
  });

  it("should handle missing pageTitle", async () => {
    mockPageTermsAndConditions.mockResolvedValueOnce({
      pageTermsAndConditionsCollection: {
        items: [
          {
            pageTitle: null,
            pageDescription: "Read our terms and conditions of service",
          },
        ],
      },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US" as const }),
    });

    expect(metadata.title).toBeUndefined();
    expect(metadata.description).toBe("Read our terms and conditions of service");
  });

  it("should handle missing pageDescription", async () => {
    mockPageTermsAndConditions.mockResolvedValueOnce({
      pageTermsAndConditionsCollection: {
        items: [
          {
            pageTitle: "Terms and Conditions",
            pageDescription: null,
          },
        ],
      },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US" as const }),
    });

    expect(metadata.title).toBe("Terms and Conditions");
    expect(metadata.description).toBeUndefined();
  });

  it("should handle both fields being null", async () => {
    mockPageTermsAndConditions.mockResolvedValueOnce({
      pageTermsAndConditionsCollection: {
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
  TermsAndConditionsPage: ({
    termsAndConditions,
    locale,
    preview,
  }: {
    termsAndConditions: unknown;
    locale: string;
    preview: boolean;
  }) => (
    <div data-testid="terms-and-conditions-content">
      {"Terms and Conditions Content - "}
      {locale}
      {" - "}
      {preview ? "preview" : "published"}
      {" - "}
      {termsAndConditions ? "with data" : "no data"}
    </div>
  ),
}));

describe("Terms and Conditions Page - Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Terms and Conditions page with data", async () => {
    const mockTermsAndConditionsData = {
      pageTitle: "Terms and Conditions",
      pageDescription: "Read our terms and conditions of service",
    };

    mockPageTermsAndConditions.mockResolvedValueOnce({
      pageTermsAndConditionsCollection: {
        items: [mockTermsAndConditionsData],
      },
    });

    render(
      await TermsAndConditionsPageRoute({
        params: Promise.resolve({ locale: "en-US" as const }),
      }),
    );

    expect(screen.getByTestId("terms-and-conditions-content")).toBeInTheDocument();
    expect(screen.getByTestId("terms-and-conditions-content")).toHaveTextContent(
      "Terms and Conditions Content - en-US - published - with data",
    );
  });

  it("renders Terms and Conditions page with different locale", async () => {
    const mockTermsAndConditionsData = {
      pageTitle: "Geschäftsbedingungen",
      pageDescription: "Lesen Sie unsere Geschäftsbedingungen",
    };

    mockPageTermsAndConditions.mockResolvedValueOnce({
      pageTermsAndConditionsCollection: {
        items: [mockTermsAndConditionsData],
      },
    });

    render(
      await TermsAndConditionsPageRoute({ params: Promise.resolve({ locale: "de" as const }) }),
    );

    expect(screen.getByTestId("terms-and-conditions-content")).toHaveTextContent(
      "Terms and Conditions Content - de - published - with data",
    );
  });

  it("passes correct parameters to getTermsAndConditionsData", async () => {
    const mockTermsAndConditionsData = { pageTitle: "Terms and Conditions" };

    mockPageTermsAndConditions.mockResolvedValueOnce({
      pageTermsAndConditionsCollection: {
        items: [mockTermsAndConditionsData],
      },
    });

    await TermsAndConditionsPageRoute({ params: Promise.resolve({ locale: "en-US" as const }) });

    expect(mockPageTermsAndConditions).toHaveBeenCalledWith({ locale: "en-US", preview: false });
  });
});
