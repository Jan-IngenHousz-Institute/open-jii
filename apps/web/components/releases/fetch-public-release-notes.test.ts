import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAllReleaseNotes, getReleaseNoteBySlug } from "./fetch-public-release-notes";

const { published, preview } = vi.hoisted(() => ({
  published: { allReleaseNotes: vi.fn(), releaseNoteBySlug: vi.fn() },
  preview: { allReleaseNotes: vi.fn(), releaseNoteBySlug: vi.fn() },
}));

vi.mock("~/lib/contentful", () => ({
  getContentfulClients: () => Promise.resolve({ client: published, previewClient: preview }),
}));

const note = (id: string, publishedAt = "2026-06-20T00:00:00.000Z") => ({
  sys: { id },
  slug: `release-${id}`,
  title: `Release ${id}`,
  publishedAt,
});

const collectionOf = (items: unknown[]) => ({ componentReleaseNoteCollection: { items } });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAllReleaseNotes", () => {
  it("reads published notes without the preview client and drops empty items", async () => {
    published.allReleaseNotes.mockResolvedValue(collectionOf([note("a"), null]));

    expect(await getAllReleaseNotes("en-US", false)).toEqual([note("a")]);
    expect(published.allReleaseNotes).toHaveBeenCalledWith(
      expect.objectContaining({ preview: false, locale: "en-US" }),
    );
    expect(preview.allReleaseNotes).not.toHaveBeenCalled();
  });

  it("reads drafts through the preview client", async () => {
    preview.allReleaseNotes.mockResolvedValue(collectionOf([]));

    expect(await getAllReleaseNotes("de-DE", true)).toEqual([]);
    expect(preview.allReleaseNotes).toHaveBeenCalledWith(
      expect.objectContaining({ preview: true, locale: "de-DE" }),
    );
    expect(published.allReleaseNotes).not.toHaveBeenCalled();
  });
});

describe("getReleaseNoteBySlug", () => {
  it("returns the published note with that slug", async () => {
    published.releaseNoteBySlug.mockResolvedValue(collectionOf([note("b")]));

    expect(await getReleaseNoteBySlug("en-US", "release-b", false)).toEqual(note("b"));
    expect(published.releaseNoteBySlug).toHaveBeenCalledWith({
      slug: "release-b",
      locale: "en-US",
      preview: false,
    });
  });

  it("hides a published note until its scheduled time", async () => {
    published.releaseNoteBySlug.mockResolvedValue(
      collectionOf([note("c", "2999-01-01T00:00:00.000Z")]),
    );

    expect(await getReleaseNoteBySlug("en-US", "release-c", false)).toBeNull();
  });

  it("shows a scheduled note in preview", async () => {
    const scheduled = note("d", "2999-01-01T00:00:00.000Z");
    preview.releaseNoteBySlug.mockResolvedValue(collectionOf([scheduled]));

    expect(await getReleaseNoteBySlug("en-US", "release-d", true)).toEqual(scheduled);
    expect(published.releaseNoteBySlug).not.toHaveBeenCalled();
  });

  it("returns null when no note has the slug", async () => {
    published.releaseNoteBySlug.mockResolvedValue(collectionOf([]));

    expect(await getReleaseNoteBySlug("en-US", "missing", false)).toBeNull();
  });
});
