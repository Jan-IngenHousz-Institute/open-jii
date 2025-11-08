import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import PoliciesPage, { generateMetadata } from "./page";

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

vi.mock("@repo/cms", () => ({
  PoliciesContent: ({
    policies,
    locale,
    preview,
  }: {
    policies: unknown;
    locale: string;
    preview: boolean;
  }) => (
    <div data-testid="policies-content">
      {"Policies Content - "}
      {locale}
      {" - "}
      {preview ? "preview" : "published"}
      {" - "}
      {policies ? "with data" : "no data"}
    </div>
  ),
}));

describe("Policies Page - Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Policies page with data", async () => {
    const mockPoliciesData = {
      pageTitle: "Privacy Policy",
      pageDescription: "Read our privacy policy and terms of service",
    };
    
    mockPagePolicies.mockResolvedValueOnce({
      pagePoliciesCollection: {
        items: [mockPoliciesData],
      },
    });

    render(await PoliciesPage({ params: Promise.resolve({ locale: "en-US" as const }) }));

    expect(screen.getByTestId("policies-content")).toBeInTheDocument();
    expect(screen.getByTestId("policies-content")).toHaveTextContent(
      "Policies Content - en-US - published - with data",
    );
  });

  it("renders Policies page with different locale", async () => {
    const mockPoliciesData = {
      pageTitle: "Datenschutzrichtlinie",
      pageDescription: "Lesen Sie unsere Datenschutzrichtlinie und Nutzungsbedingungen",
    };
    
    mockPagePolicies.mockResolvedValueOnce({
      pagePoliciesCollection: {
        items: [mockPoliciesData],
      },
    });

    render(await PoliciesPage({ params: Promise.resolve({ locale: "de" as const }) }));

    expect(screen.getByTestId("policies-content")).toHaveTextContent(
      "Policies Content - de - published - with data",
    );
  });

  it("passes correct parameters to getPoliciesData", async () => {
    const mockPoliciesData = { pageTitle: "Privacy Policy" };
    
    mockPagePolicies.mockResolvedValueOnce({
      pagePoliciesCollection: {
        items: [mockPoliciesData],
      },
    });

    await PoliciesPage({ params: Promise.resolve({ locale: "en-US" as const }) });

    expect(mockPagePolicies).toHaveBeenCalledWith({ locale: "en-US", preview: false });
  });
});
