import { describe, it, expect, vi, beforeEach } from "vitest";
import { getContentfulClients } from "~/lib/contentful";

import { fetchWebReleaseNotes } from "./fetch-release-notes";

// unstable_cache requires Next.js incremental cache context unavailable in vitest — strip it to a passthrough
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

const mockActiveReleaseNotes = vi.fn();

const makeNote = (id: string, overrides: Record<string, unknown> = {}) => ({
  __typename: "ComponentReleaseNote",
  sys: { id },
  slug: `release-${id}`,
  title: `Release ${id}`,
  summary: "Summary",
  category: "feature",
  surfaces: ["web"],
  publishedAt: "2026-06-20T00:00:00.000Z",
  active: true,
  ...overrides,
});

describe("fetchWebReleaseNotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getContentfulClients).mockResolvedValue({
      client: { activeReleaseNotes: mockActiveReleaseNotes },
      previewClient: { activeReleaseNotes: mockActiveReleaseNotes },
    } as never);
  });

  it("queries Contentful for active web release notes in the given locale", async () => {
    mockActiveReleaseNotes.mockResolvedValue({
      componentReleaseNoteCollection: { items: [] },
    });

    await fetchWebReleaseNotes("de-DE");

    expect(mockActiveReleaseNotes).toHaveBeenCalledWith(
      expect.objectContaining({
        preview: false,
        locale: "de-DE",
        surfaces: ["web", "both"],
      }),
    );
  });

  it("returns the fetched release notes", async () => {
    const notes = [makeNote("1"), makeNote("2")];
    mockActiveReleaseNotes.mockResolvedValue({
      componentReleaseNoteCollection: { items: notes },
    });

    await expect(fetchWebReleaseNotes("en-US")).resolves.toEqual(notes);
  });

  it("filters out null items from the collection", async () => {
    const note = makeNote("1");
    mockActiveReleaseNotes.mockResolvedValue({
      componentReleaseNoteCollection: { items: [null, note, null] },
    });

    await expect(fetchWebReleaseNotes("en-US")).resolves.toEqual([note]);
  });

  it("returns an empty list when the collection is missing", async () => {
    mockActiveReleaseNotes.mockResolvedValue({ componentReleaseNoteCollection: null });

    await expect(fetchWebReleaseNotes("en-US")).resolves.toEqual([]);
  });

  it("returns an empty list when the Contentful query fails", async () => {
    mockActiveReleaseNotes.mockRejectedValue(new Error("Contentful down"));

    await expect(fetchWebReleaseNotes("en-US")).resolves.toEqual([]);
  });

  it("returns an empty list when the Contentful client cannot be created", async () => {
    vi.mocked(getContentfulClients).mockRejectedValue(new Error("missing credentials"));

    await expect(fetchWebReleaseNotes("en-US")).resolves.toEqual([]);
  });
});
