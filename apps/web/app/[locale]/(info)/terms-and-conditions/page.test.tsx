import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import TermsAndConditionsPageRoute, { generateMetadata } from "./page";

const mockPageTerms = vi.fn();
vi.mock("~/lib/contentful", () => ({
  getContentfulClients: () =>
    Promise.resolve({
      client: { pageTermsAndConditions: mockPageTerms },
      previewClient: { pageTermsAndConditions: mockPageTerms },
    }),
}));

vi.mock("@repo/cms", () => ({
  TermsAndConditionsPage: ({ locale }: { locale: string }) => (
    <div data-testid="terms-content">Terms - {locale}</div>
  ),
}));

const termsData = {
  pageTitle: "Terms and Conditions",
  pageDescription: "Read our terms and conditions",
};

const defaultProps = { params: Promise.resolve({ locale: "en-US" as const }) };

describe("TermsAndConditionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPageTerms.mockResolvedValue({
      pageTermsAndConditionsCollection: { items: [termsData] },
    });
  });

  it("generates metadata from Contentful", async () => {
    const metadata = await generateMetadata(defaultProps);

    expect(metadata).toEqual({
      title: "Terms and Conditions",
      description: "Read our terms and conditions",
    });
  });

  it("omits null metadata fields", async () => {
    mockPageTerms.mockResolvedValue({
      pageTermsAndConditionsCollection: {
        items: [{ pageTitle: null, pageDescription: null }],
      },
    });

    const metadata = await generateMetadata(defaultProps);

    expect(metadata.title).toBeUndefined();
    expect(metadata.description).toBeUndefined();
  });

  it("renders TermsAndConditionsPage with locale", async () => {
    render(await TermsAndConditionsPageRoute(defaultProps));

    expect(screen.getByTestId("terms-content")).toHaveTextContent("Terms - en-US");
  });

  it("passes correct params to Contentful", async () => {
    await TermsAndConditionsPageRoute(defaultProps);

    expect(mockPageTerms).toHaveBeenCalledWith({ locale: "en-US", preview: false });
  });
});
