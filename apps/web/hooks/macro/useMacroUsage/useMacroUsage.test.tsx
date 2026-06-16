import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useMacroUsage } from "./useMacroUsage";

const ID = "11111111-1111-1111-1111-111111111111";

describe("useMacroUsage", () => {
  it("returns the usage count and referencing workbooks", async () => {
    server.mount(contract.macros.getMacroUsage, {
      body: { count: 2, workbooks: [{ id: ID, name: "WB A" }] },
    });

    const { result } = renderHook(() => useMacroUsage("m-1"));

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.body.count).toBe(2);
  });

  it("stays idle without a macro id", () => {
    const { result } = renderHook(() => useMacroUsage(""));
    expect(result.current.fetchStatus).toBe("idle");
  });
});
