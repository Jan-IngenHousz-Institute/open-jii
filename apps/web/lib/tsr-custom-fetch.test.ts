import type { ApiFetcherArgs } from "@ts-rest/core";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { tsrCustomApiFetcher } from "./tsr-custom-fetch";

// Stubbing `globalThis.fetch` (rather than `vi.mock("@ts-rest/core")`) to
// keep this test stable under `isolate: false`. Module mocks of packages
// that other test files have already imported don't take effect — the
// cached binding wins — but `vi.stubGlobal` replaces a live global and
// `vi.unstubAllGlobals` restores it deterministically after each test.
//
// The minimal `route` shape below is what `tsRestFetchApi` needs to
// resolve response contracts; we only exercise the transport layer, so
// the responses map can stay empty.
const minimalRoute = {
  method: "GET" as const,
  path: "/",
  responses: {},
};

describe("tsrCustomApiFetcher", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards args with merged headers and returns successful responses", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const args = {
      path: "http://tsr-custom-fetch.test/api/x",
      method: "GET",
      headers: { Authorization: "bearer" },
      route: minimalRoute,
    } as unknown as ApiFetcherArgs;

    const response = await tsrCustomApiFetcher(args);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [unknown, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("bearer");
  });

  it("throws the response when status is 400 or greater", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "boom" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const args = {
      path: "http://tsr-custom-fetch.test/api/err",
      method: "GET",
      headers: {},
      route: minimalRoute,
    } as unknown as ApiFetcherArgs;

    await expect(tsrCustomApiFetcher(args)).rejects.toMatchObject({
      status: 500,
      body: { message: "boom" },
    });
  });
});
