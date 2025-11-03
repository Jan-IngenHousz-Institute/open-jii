import "@testing-library/jest-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { generateMetadata } from "./page";

vi.mock("next/headers", () => ({
  draftMode: vi.fn(() => Promise.resolve({ isEnabled: false })),
}));

const mockPagePolicies = vi.fn();

vi.mock("~/lib/contentful", () => ({
  getContentfulClients: vi.fn(() =>
    Promise.resolve({
      client: {
        pagePolicies: mockPagePolicies,
      },
      previewClient: {
        pagePolicies: mockPagePolicies,
      },
    }),
  ),
}));

describe("Policies Page - generateMetadata", () => {
  const mockPoliciesData = {
    pageTitle: "Privacy Policy",
    pageDescription: "Read our privacy policy and terms of service",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate metadata from Contentful when data is available", async () => {
    mockPagePolicies.mockResolvedValueOnce({
      pagePoliciesCollection: {
        items: [mockPoliciesData],
      },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US" as const }),
    });

    expect(metadata).toEqual({
      title: "Privacy Policy",
      description: "Read our privacy policy and terms of service",
    });
  });

  it("should handle missing pageTitle", async () => {
    mockPagePolicies.mockResolvedValueOnce({
      pagePoliciesCollection: {
        items: [
          {
            pageTitle: null,
            pageDescription: "Read our privacy policy and terms of service",
          },
        ],
      },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US" as const }),
    });

    expect(metadata.title).toBeUndefined();
    expect(metadata.description).toBe("Read our privacy policy and terms of service");
  });

  it("should handle missing pageDescription", async () => {
    mockPagePolicies.mockResolvedValueOnce({
      pagePoliciesCollection: {
        items: [
          {
            pageTitle: "Privacy Policy",
            pageDescription: null,
          },
        ],
      },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US" as const }),
    });

    expect(metadata.title).toBe("Privacy Policy");
    expect(metadata.description).toBeUndefined();
  });

  it("should handle both fields being null", async () => {
    mockPagePolicies.mockResolvedValueOnce({
      pagePoliciesCollection: {
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
