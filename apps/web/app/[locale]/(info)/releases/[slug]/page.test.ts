import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAllReleaseNotes,
  getReleaseNoteBySlug,
} from "~/components/releases/fetch-public-release-notes";

import { generateMetadata, generateStaticParams } from "./page";

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

describe("release detail prerendering", () => {
  it("builds every published note ahead in the locale its layout builds", async () => {
    vi.mocked(getAllReleaseNotes).mockResolvedValue([
      { __typename: "ComponentReleaseNote", sys: { id: "1" }, slug: "summer-update" },
      { __typename: "ComponentReleaseNote", sys: { id: "2" }, slug: null },
    ]);

    const params = await generateStaticParams({ params: { locale: "en-US" } });

    expect(getAllReleaseNotes).toHaveBeenCalledWith("en-US", false);
    expect(params).toEqual([{ slug: "summer-update" }]);
  });

  it("builds no note ahead when the layout built no locale", async () => {
    vi.mocked(getAllReleaseNotes).mockClear();

    await expect(generateStaticParams({ params: {} })).resolves.toEqual([]);
    expect(getAllReleaseNotes).not.toHaveBeenCalled();
  });
});
