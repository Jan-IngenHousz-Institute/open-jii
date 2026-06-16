import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useProtocolVersions } from "./useProtocolVersions";

const USER = "11111111-1111-1111-1111-111111111111";

describe("useProtocolVersions", () => {
  it("returns the version list newest-first", async () => {
    server.mount(contract.protocols.listProtocolVersions, {
      body: [
        { version: 2, createdBy: USER, createdAt: "2024-01-02T00:00:00Z" },
        { version: 1, createdBy: USER, createdAt: "2024-01-01T00:00:00Z" },
      ],
    });

    const { result } = renderHook(() => useProtocolVersions("p-1"));

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.body.map((v) => v.version)).toEqual([2, 1]);
  });

  it("stays idle without a protocol id", () => {
    const { result } = renderHook(() => useProtocolVersions(""));
    expect(result.current.fetchStatus).toBe("idle");
  });
});
