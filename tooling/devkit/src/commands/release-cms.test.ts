import { describe, expect, it, vi } from "vitest";

import { releaseCms } from "./release-cms.js";
import type { Note } from "./release-cms.js";

const config = { space: "space", environment: "staging", token: "secret-token" };
const note: Note = {
  locale: "en-US",
  fields: { slug: "september", title: "New title", surfaces: "web" },
};
const schema = {
  fields: [
    { id: "slug", localized: false },
    { id: "title", localized: true },
    { id: "surfaces", localized: false },
  ],
};
const locales = {
  items: [
    { code: "en-US", default: true },
    { code: "nl-NL", default: false },
  ],
};
const existing = {
  sys: { id: "note-1", version: 4, contentType: { sys: { id: "componentReleaseNote" } } },
  fields: {
    slug: { "en-US": "september" },
    title: { "en-US": "Old title", "nl-NL": "Titel" },
    active: { "en-US": true },
  },
  metadata: { tags: [{ sys: { type: "Link", linkType: "Tag", id: "release" } }] },
};
function bodyJson(body: unknown): unknown {
  if (typeof body !== "string") throw new Error("Expected JSON body");
  return JSON.parse(body) as unknown;
}
function urlString(url: Parameters<typeof fetch>[0]): string {
  return url instanceof Request ? url.url : url.toString();
}
function response(body: unknown): Response {
  return Response.json(body);
}
function discovery(total = 0, items: unknown[] = []) {
  return vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(response(schema))
    .mockResolvedValueOnce(response(locales))
    .mockResolvedValueOnce(response({ total, items }));
}

describe("release CMS", () => {
  it.each(["inspect", "draft", "publish"] as const)(
    "makes zero requests in %s dry run without credentials",
    async (action) => {
      const request = vi.fn<typeof fetch>();
      const result = await releaseCms(
        {
          action,
          dryRun: true,
          ...(action === "draft" ? { note } : {}),
          ...(action === "publish" ? { entryId: "note-1", version: 4 } : {}),
        },
        { space: "", environment: "", token: "" },
        request,
      );
      expect(result).toMatchObject({ dryRun: true, networkRequests: 0 });
      expect(request).not.toHaveBeenCalled();
    },
  );

  it("keeps credentials out of dry-run output", async () => {
    const output = await releaseCms({ action: "draft", dryRun: true, note }, config);
    expect(JSON.stringify(output)).not.toContain(config.token);
  });

  it("reports missing live credentials without making requests", async () => {
    const request = vi.fn<typeof fetch>();
    await expect(
      releaseCms({ action: "draft", note }, { ...config, token: "" }, request),
    ).rejects.toThrow("CONTENTFUL_MANAGEMENT_TOKEN or CMA");
    expect(request).not.toHaveBeenCalled();
  });

  it("creates a stable unpublished entry and verifies it", async () => {
    const ids: string[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const request = discovery();
      const fields = {
        slug: { "en-US": "september" },
        title: { "en-US": "New title" },
        surfaces: { "en-US": "web" },
      };
      request
        .mockImplementationOnce((url, init) => {
          ids.push(urlString(url));
          expect(init?.method).toBe("PUT");
          expect(init?.headers).toMatchObject({ "X-Contentful-Version": "0" });
          expect(bodyJson(init?.body)).toEqual({ fields });
          return Promise.resolve(response({ ...existing, fields }));
        })
        .mockResolvedValueOnce(response({ ...existing, fields }));
      await expect(releaseCms({ action: "draft", note }, config, request)).resolves.toMatchObject({
        drafted: true,
      });
      expect(request.mock.calls.some(([url]) => urlString(url).endsWith("/published"))).toBe(false);
    }
    expect(ids[0]).toBe(ids[1]);
  });

  it("preserves other fields, locales and metadata during a versioned update", async () => {
    const request = discovery(1, [existing]);
    const fields = {
      ...existing.fields,
      title: { "en-US": "New title", "nl-NL": "Titel" },
      surfaces: { "en-US": "web" },
    };
    request
      .mockImplementationOnce((_url, init) => {
        expect(init?.headers).toMatchObject({ "X-Contentful-Version": "4" });
        expect(bodyJson(init?.body)).toEqual({ fields, metadata: existing.metadata });
        return Promise.resolve(response(existing));
      })
      .mockResolvedValueOnce(response({ ...existing, fields }));
    await releaseCms({ action: "draft", note, version: 4 }, config, request);
  });

  it("localizes translated fields and keeps nonlocalized ones in the default locale", async () => {
    const request = discovery(1, [existing]);
    const fields = {
      ...existing.fields,
      title: { "en-US": "Old title", "nl-NL": "Nieuw" },
      surfaces: { "en-US": "web" },
    };
    request
      .mockResolvedValueOnce(response(existing))
      .mockResolvedValueOnce(response({ ...existing, fields }));
    await releaseCms(
      {
        action: "draft",
        note: { ...note, locale: "nl-NL", fields: { ...note.fields, title: "Nieuw" } },
        version: 4,
      },
      config,
      request,
    );
    expect(bodyJson(request.mock.calls[3]?.[1]?.body)).toMatchObject({ fields });
  });

  it("treats an identical rerun as a read-only no-op", async () => {
    const request = discovery(1, [existing]);
    await expect(
      releaseCms(
        {
          action: "draft",
          note: { locale: "en-US", fields: { slug: "september", title: "Old title" } },
        },
        config,
        request,
      ),
    ).resolves.toMatchObject({ unchanged: true });
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("refuses duplicates and edits without the reviewed version", async () => {
    const duplicates = discovery(2, [existing, existing]);
    await expect(releaseCms({ action: "draft", note }, config, duplicates)).rejects.toThrow(
      "Multiple notes",
    );
    const stale = discovery(1, [existing]);
    await expect(releaseCms({ action: "draft", note, version: 3 }, config, stale)).rejects.toThrow(
      "reviewed --version 4",
    );
    expect(stale).toHaveBeenCalledTimes(3);
  });

  it("does not retry a conflict or reveal its response body", async () => {
    const request = discovery(1, [existing]).mockResolvedValueOnce(
      new Response("private error details", { status: 409 }),
    );
    await expect(
      releaseCms({ action: "draft", note, version: 4 }, config, request),
    ).rejects.toThrow("409; no automatic retry");
    expect(request).toHaveBeenCalledTimes(4);
  });

  it("rejects an unknown field or a list of surfaces before writing", async () => {
    const request = discovery();
    await expect(
      releaseCms(
        { action: "draft", note: { ...note, fields: { ...note.fields, typo: true } } },
        config,
        request,
      ),
    ).rejects.toThrow("Unknown content field");
    expect(request).toHaveBeenCalledTimes(2);
    const untouched = vi.fn<typeof fetch>();
    await expect(
      releaseCms(
        {
          action: "draft",
          dryRun: true,
          note: { ...note, fields: { ...note.fields, surfaces: ["web"] } },
        },
        config,
        untouched,
      ),
    ).rejects.toThrow("surfaces");
    expect(untouched).not.toHaveBeenCalled();
  });

  it("publishes only the reviewed release-note version and reads it back", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(response(existing)));
    await releaseCms({ action: "publish", entryId: "note-1", version: 4 }, config, request);
    expect(request.mock.calls[1]?.[0]).toBe(
      "https://api.contentful.com/spaces/space/environments/staging/entries/note-1/published",
    );
    expect(request.mock.calls[1]?.[1]).toMatchObject({
      method: "PUT",
      headers: { "X-Contentful-Version": "4" },
    });
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("refuses a changed publish version and never publishes a force-update gate", async () => {
    const stale = vi.fn<typeof fetch>().mockResolvedValue(response(existing));
    await expect(
      releaseCms({ action: "publish", entryId: "note-1", version: 3 }, config, stale),
    ).rejects.toThrow("version changed");
    expect(stale).toHaveBeenCalledTimes(1);
    const gate = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        ...existing,
        sys: { ...existing.sys, contentType: { sys: { id: "pageForceUpdate" } } },
      }),
    );
    await expect(
      releaseCms({ action: "publish", entryId: "gate", version: 4 }, config, gate),
    ).rejects.toThrow("gates require the gate recipe");
    expect(gate).toHaveBeenCalledTimes(1);
  });
});
