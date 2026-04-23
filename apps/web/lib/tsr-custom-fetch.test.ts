import { tsRestFetchApi } from "@ts-rest/core";
import type { ApiFetcherArgs } from "@ts-rest/core";
import type * as TsRestCore from "@ts-rest/core";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { tsrCustomApiFetcher } from "./tsr-custom-fetch";

vi.mock("@ts-rest/core", async () => {
  const actual = await vi.importActual<typeof TsRestCore>("@ts-rest/core");
  return { ...actual, tsRestFetchApi: vi.fn() };
});

describe("tsrCustomApiFetcher", () => {
  beforeEach(() => {
    vi.mocked(tsRestFetchApi).mockReset();
  });

  it("forwards args with merged headers and returns successful responses", async () => {
    const response = { status: 200, body: { ok: true } };
    vi.mocked(tsRestFetchApi).mockResolvedValue(response as never);

    const args: ApiFetcherArgs = {
      route: { method: "GET", path: "/api/x", responses: {} } as ApiFetcherArgs["route"],
      path: "/api/x",
      method: "GET",
      headers: { Authorization: "bearer" },
      body: undefined,
      rawBody: undefined,
      rawQuery: undefined,
      contentType: undefined,
    };

    await expect(tsrCustomApiFetcher(args)).resolves.toBe(response);

    expect(tsRestFetchApi).toHaveBeenCalledWith({
      ...args,
      headers: { Authorization: "bearer" },
    });
  });

  it("throws the response when status is 400 or greater", async () => {
    const response = { status: 500, body: {} };
    vi.mocked(tsRestFetchApi).mockResolvedValue(response as never);

    await expect(tsrCustomApiFetcher({} as ApiFetcherArgs)).rejects.toBe(response);
  });
});
