/**
 * useMacro hook test — MSW-based.
 *
 * The real hook calls `tsr.macros.getMacro.useQuery` →
 * `GET /api/v1/macros/:id`. MSW intercepts that request.
 */
import { createMacro } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api";

import { useMacro } from "./useMacro";

describe("useMacro", () => {
  it("returns unwrapped macro data from MSW", async () => {
    const macro = createMacro({ id: "m-1", name: "My Macro", code: 'print("hi")' });
    server.mount(contract.macros.getMacro, { body: macro });

    const { result } = renderHook(() => useMacro("m-1"));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    // Hook unwraps data?.body
    expect(result.current.data).toMatchObject({ id: "m-1", name: "My Macro" });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("returns error when API fails", async () => {
    server.mount(contract.macros.getMacro, { status: 404 });

    const { result } = renderHook(() => useMacro("bad"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeUndefined();
  });
});
