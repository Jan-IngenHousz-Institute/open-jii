import { beforeEach, describe, expect, it, vi } from "vitest";
import { getReleaseNoteBySlug } from "~/components/releases/fetch-public-release-notes";

import { generateMetadata } from "./page";

vi.mock("~/components/releases/fetch-public-release-notes", () => ({
  getAllReleaseNotes: vi.fn(),
  getReleaseNoteBySlug: vi.fn(),
}));

describe("release detail metadata", () => {
  beforeEach(() => {
    vi.mocked(getReleaseNoteBySlug).mockResolvedValue({
      slug: "summer-update",
      title: "Summer update",
      summary: "Release summary",
    } as never);
  });

  it("uses the exact locale-prefixed canonical and advertises only the default locale", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en-US", slug: "summer-update" }),
    });

    expect(metadata.alternates).toEqual({
      canonical: "/en-US/releases/summer-update",
      languages: { "en-US": "/en-US/releases/summer-update" },
    });
  });
});
