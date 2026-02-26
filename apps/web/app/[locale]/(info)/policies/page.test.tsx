import { render, screen } from "@/test/test-utils";
import { draftMode } from "next/headers";
import { vi, describe, it, expect, beforeEach } from "vitest";

import PoliciesPage, { generateMetadata } from "./page";

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

vi.mock("@repo/cms", () => ({
  PoliciesContent: ({
    locale,
    preview,
  }: {
    policies: unknown;
    locale: string;
    preview: boolean;
  }) => (
    <section aria-label="policies content">
      {locale}
      {preview ? " preview" : " published"}
    </section>
  ),
}));

const policiesData = {
  pageTitle: "Privacy Policy",
  pageDescription: "Read our privacy policy and terms of service",
};

const defaultProps = { params: Promise.resolve({ locale: "en-US" as const }) };

describe("PoliciesPage", () => {
  beforeEach(() => {
    mockPagePolicies.mockResolvedValue({
      pagePoliciesCollection: { items: [policiesData] },
    });
  });

  describe("generateMetadata", () => {
    it("returns title and description from CMS", async () => {
      const metadata = await generateMetadata(defaultProps);
      expect(metadata).toEqual({
        title: "Privacy Policy",
        description: "Read our privacy policy and terms of service",
      });
    });

    it("omits null metadata fields", async () => {
      mockPagePolicies.mockResolvedValue({
        pagePoliciesCollection: {
          items: [{ pageTitle: null, pageDescription: null }],
        },
      });
      const metadata = await generateMetadata(defaultProps);
      expect(metadata).toEqual({});
    });
  });

  it("renders PoliciesContent with locale", async () => {
    render(await PoliciesPage(defaultProps));
    expect(screen.getByRole("region", { name: /policies content/i })).toHaveTextContent(
      "en-US published",
    );
  });

  it("passes preview flag when draft mode is enabled", async () => {
    vi.mocked(draftMode).mockResolvedValue({ isEnabled: true } as never);
    render(await PoliciesPage(defaultProps));
    expect(screen.getByRole("region", { name: /policies content/i })).toHaveTextContent(
      "en-US preview",
    );
  });

  it("passes correct locale to Contentful query", async () => {
    await PoliciesPage({ params: Promise.resolve({ locale: "de" as const }) });
    expect(mockPagePolicies).toHaveBeenCalledWith({ locale: "de", preview: false });
  });
});
