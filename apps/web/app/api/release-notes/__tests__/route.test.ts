import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchWebReleaseNotes } from "~/components/whats-new/fetch-release-notes";

import { GET } from "../route";

vi.mock("~/components/whats-new/fetch-release-notes", () => ({
  fetchWebReleaseNotes: vi.fn(),
}));

const note = {
  __typename: "ComponentReleaseNote" as const,
  sys: { id: "note-1" },
  publishedAt: "2026-10-01T00:00:00.000Z",
};

describe("GET /api/release-notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchWebReleaseNotes).mockResolvedValue([note]);
  });

  it("returns the locale's notes, cacheable at the edge", async () => {
    const response = await GET(
      new NextRequest("https://example.com/api/release-notes?locale=de-DE"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([note]);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, s-maxage=300, stale-while-revalidate=300",
    );
    expect(fetchWebReleaseNotes).toHaveBeenCalledWith("de-DE");
  });

  it("rejects an unknown locale", async () => {
    const response = await GET(
      new NextRequest("https://example.com/api/release-notes?locale=xx-XX"),
    );

    expect(response.status).toBe(400);
    expect(fetchWebReleaseNotes).not.toHaveBeenCalled();
  });

  it("rejects a request without a locale", async () => {
    const response = await GET(new NextRequest("https://example.com/api/release-notes"));

    expect(response.status).toBe(400);
  });
});
