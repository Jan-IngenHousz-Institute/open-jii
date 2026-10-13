import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { http, HttpResponse } from "msw";
import { describe, it, expect } from "vitest";

import { useReleaseNotes } from "./useReleaseNotes";

const note = {
  __typename: "ComponentReleaseNote",
  sys: { id: "note-1" },
  title: "Faster tabs",
  publishedAt: "2026-10-01T00:00:00.000Z",
};

describe("useReleaseNotes", () => {
  it("returns the notes for the requested locale", async () => {
    let requestedLocale: string | null = null;
    server.use(
      http.get("*/api/release-notes", ({ request }) => {
        requestedLocale = new URL(request.url).searchParams.get("locale");
        return HttpResponse.json([note]);
      }),
    );

    const { result } = renderHook(() => useReleaseNotes("de-DE"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([note]);
    expect(requestedLocale).toBe("de-DE");
  });

  it("fails when the route answers with an error", async () => {
    server.use(http.get("*/api/release-notes", () => new HttpResponse(null, { status: 500 })));

    const { result } = renderHook(() => useReleaseNotes("en-US"));

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("fails when the answer is not a list of notes", async () => {
    server.use(http.get("*/api/release-notes", () => HttpResponse.json({ notes: [note] })));

    const { result } = renderHook(() => useReleaseNotes("en-US"));

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
