import { render, screen } from "@/test/test-utils";
import { draftMode } from "next/headers";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { TermsAndConditionsDialog } from "./terms-and-conditions-dialog";

const { mockClient, mockPreviewClient } = vi.hoisted(() => ({
  mockClient: { pageTermsAndConditions: vi.fn() },
  mockPreviewClient: { pageTermsAndConditions: vi.fn() },
}));

vi.mock("~/lib/contentful", () => ({
  getContentfulClients: vi.fn().mockResolvedValue({
    client: mockClient,
    previewClient: mockPreviewClient,
  }),
}));

vi.mock("@repo/cms", () => ({
  TermsAndConditionsTitle: (props: { termsAndConditions?: { title?: string } }) => (
    <div data-testid="cms-title">{props.termsAndConditions?.title ?? "No title"}</div>
  ),
  TermsAndConditionsContent: (props: { termsAndConditions?: { content?: string } }) => (
    <div data-testid="cms-content">{props.termsAndConditions?.content ?? "No content"}</div>
  ),
}));

describe("TermsAndConditionsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns CMS title and content when query succeeds", async () => {
    mockClient.pageTermsAndConditions.mockResolvedValue({
      pageTermsAndConditionsCollection: { items: [{ title: "Terms", content: "Body" }] },
    });

    const result = await TermsAndConditionsDialog({ locale: "en-US" });

    render(<>{result.title}</>);
    expect(screen.getByText("Terms")).toBeInTheDocument();

    render(<>{result.content}</>);
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("uses previewClient in draft mode", async () => {
    vi.mocked(draftMode).mockResolvedValueOnce({ isEnabled: true } as never);

    mockPreviewClient.pageTermsAndConditions.mockResolvedValue({
      pageTermsAndConditionsCollection: { items: [{ title: "Preview" }] },
    });

    const result = await TermsAndConditionsDialog({ locale: "en-US" });

    render(<>{result.title}</>);
    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(mockPreviewClient.pageTermsAndConditions).toHaveBeenCalledWith({
      locale: "en-US",
      preview: true,
    });
  });

  it("returns fallback on error", async () => {
    mockClient.pageTermsAndConditions.mockRejectedValue(new Error("fail"));

    const result = await TermsAndConditionsDialog({ locale: "en-US" });

    expect(result.title).toBe("registration.termsAndConditions");
    render(<>{result.content}</>);
    expect(screen.getByText("errors.termsUnavailable")).toBeInTheDocument();
  });

  it("passes locale to Contentful", async () => {
    mockClient.pageTermsAndConditions.mockResolvedValue({
      pageTermsAndConditionsCollection: { items: [{ title: "DE" }] },
    });

    await TermsAndConditionsDialog({ locale: "de-DE" });

    expect(mockClient.pageTermsAndConditions).toHaveBeenCalledWith({
      locale: "de-DE",
      preview: false,
    });
  });
});
