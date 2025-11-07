import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { TermsAndConditionsDialog } from "./terms-and-conditions-dialog";

globalThis.React = React;

// --- Mocks ---
const mockDraftMode = vi.fn();
vi.mock("next/headers", () => ({
  draftMode: (): { isEnabled: boolean } => mockDraftMode() as { isEnabled: boolean },
}));

const mockPreviewClient = { pageTermsAndConditions: vi.fn() };
const mockClient = { pageTermsAndConditions: vi.fn() };
const mockGetContentfulClients = vi.fn();
vi.mock("~/lib/contentful", () => ({
  getContentfulClients: (): {
    client: typeof mockClient;
    previewClient: typeof mockPreviewClient;
  } =>
    mockGetContentfulClients() as {
      client: typeof mockClient;
      previewClient: typeof mockPreviewClient;
    },
}));

const mockT = vi.fn((key: string) => key);
vi.mock("@repo/i18n/server", () => ({
  default: vi.fn(() =>
    Promise.resolve({
      t: mockT,
    }),
  ),
}));

// Mock CMS components
vi.mock("@repo/cms", () => ({
  TermsAndConditionsTitle: ({
    termsAndConditions,
  }: {
    termsAndConditions?: { title?: string };
  }) => <div data-testid="cms-title">{termsAndConditions?.title ?? "No CMS title"}</div>,
  TermsAndConditionsContent: ({
    termsAndConditions,
  }: {
    termsAndConditions?: { content?: string };
  }) => <div data-testid="cms-content">{termsAndConditions?.content ?? "No CMS content"}</div>,
}));

describe("TermsAndConditionsDialog", () => {
  const locale = "en-US";

  beforeEach(() => {
    vi.clearAllMocks();
    mockDraftMode.mockResolvedValue({ isEnabled: false });
    mockGetContentfulClients.mockResolvedValue({
      client: mockClient,
      previewClient: mockPreviewClient,
    });
  });

  it("returns title and content from Contentful when query succeeds", async () => {
    const mockTermsData = { title: "Test Terms Title", content: "Test Terms Content" };
    mockClient.pageTermsAndConditions.mockResolvedValue({
      pageTermsAndConditionsCollection: {
        items: [mockTermsData],
      },
    });

    const result = await TermsAndConditionsDialog({ locale });

    // Render and verify the components are properly structured
    render(<>{result.title}</>);
    expect(screen.getByTestId("cms-title")).toBeInTheDocument();
    expect(screen.getByText("Test Terms Title")).toBeInTheDocument();

    render(<>{result.content}</>);
    expect(screen.getByTestId("cms-content")).toBeInTheDocument();
    expect(screen.getByText("Test Terms Content")).toBeInTheDocument();

    // Verify correct client was called
    expect(mockClient.pageTermsAndConditions).toHaveBeenCalledWith({
      locale,
      preview: false,
    });
    expect(mockPreviewClient.pageTermsAndConditions).not.toHaveBeenCalled();
  });

  it("uses previewClient when draftMode is enabled", async () => {
    const mockPreviewData = { title: "Preview Title", content: "Preview Content" };
    mockDraftMode.mockResolvedValue({ isEnabled: true });
    mockPreviewClient.pageTermsAndConditions.mockResolvedValue({
      pageTermsAndConditionsCollection: {
        items: [mockPreviewData],
      },
    });

    const result = await TermsAndConditionsDialog({ locale });

    // Verify preview content is rendered
    render(<>{result.title}</>);
    expect(screen.getByText("Preview Title")).toBeInTheDocument();

    render(<>{result.content}</>);
    expect(screen.getByText("Preview Content")).toBeInTheDocument();

    // Verify correct client was called with preview: true
    expect(mockPreviewClient.pageTermsAndConditions).toHaveBeenCalledWith({
      locale,
      preview: true,
    });
    expect(mockClient.pageTermsAndConditions).not.toHaveBeenCalled();
  });

  it("returns fallback content when Contentful query throws", async () => {
    mockClient.pageTermsAndConditions.mockRejectedValue(new Error("Network error"));

    const result = await TermsAndConditionsDialog({ locale });

    // Verify fallback title uses translation
    expect(result.title).toBe("registration.termsAndConditions");
    expect(mockT).toHaveBeenCalledWith("registration.termsAndConditions");

    // Verify fallback content is rendered correctly
    render(<>{result.content}</>);
    expect(screen.getByText("errors.termsUnavailable")).toBeInTheDocument();
    expect(mockT).toHaveBeenCalledWith("errors.termsUnavailable");
  });

  it("returns fallback content when Contentful returns empty items", async () => {
    mockClient.pageTermsAndConditions.mockResolvedValue({
      pageTermsAndConditionsCollection: {
        items: [],
      },
    });

    const result = await TermsAndConditionsDialog({ locale });

    // When no items, CMS components get undefined, so fallback to "No CMS" text
    render(<>{result.title}</>);
    expect(screen.getByText("No CMS title")).toBeInTheDocument();

    render(<>{result.content}</>);
    expect(screen.getByText("No CMS content")).toBeInTheDocument();
  });

  it("handles different locales correctly", async () => {
    const germanLocale = "de-DE";
    const mockTermsData = { title: "Nutzungsbedingungen", content: "Deutsche Inhalte" };

    mockClient.pageTermsAndConditions.mockResolvedValue({
      pageTermsAndConditionsCollection: {
        items: [mockTermsData],
      },
    });

    const result = await TermsAndConditionsDialog({ locale: germanLocale });

    // Verify correct locale was passed to Contentful
    expect(mockClient.pageTermsAndConditions).toHaveBeenCalledWith({
      locale: germanLocale,
      preview: false,
    });

    // Verify content is rendered
    render(<>{result.title}</>);
    expect(screen.getByText("Nutzungsbedingungen")).toBeInTheDocument();
  });

  it("handles translation service initialization correctly", async () => {
    mockClient.pageTermsAndConditions.mockRejectedValue(new Error("fail"));

    await TermsAndConditionsDialog({ locale });

    // Verify translations were initialized with correct parameters
    const initTranslationsMock = vi.mocked(await import("@repo/i18n/server")).default;
    expect(initTranslationsMock).toHaveBeenCalledWith({
      locale,
      namespaces: ["common"],
    });
  });
});
