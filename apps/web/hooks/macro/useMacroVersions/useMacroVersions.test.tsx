import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useMacroVersions } from "./useMacroVersions";

const USER = "11111111-1111-1111-1111-111111111111";

describe("useMacroVersions", () => {
  it("returns the version list newest-first", async () => {
    server.mount(contract.macros.listMacroVersions, {
      body: [
        { version: 2, createdBy: USER, createdAt: "2024-01-02T00:00:00Z" },
        { version: 1, createdBy: USER, createdAt: "2024-01-01T00:00:00Z" },
      ],
    });

    const { result } = renderHook(() => useMacroVersions("m-1"));

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.body.map((v) => v.version)).toEqual([2, 1]);
  });

  it("stays idle without a macro id", () => {
    const { result } = renderHook(() => useMacroVersions(""));
    expect(result.current.fetchStatus).toBe("idle");
  });
});
