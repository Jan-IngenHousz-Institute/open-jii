import { createMacro } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api";

import { useMacros } from "./useMacros";

describe("useMacros", () => {
  it("returns empty array by default", async () => {
    server.mount(contract.macros.listMacros, { body: [] });

    const { result } = renderHook(() => useMacros());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("returns macros list", async () => {
    server.mount(contract.macros.listMacros, {
      body: [
        createMacro({ id: "1", name: "M1" }),
        createMacro({ id: "2", name: "M2", language: "javascript" }),
      ],
    });

    const { result } = renderHook(() => useMacros());

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
    });

    const first = result.current.data?.[0];
    const second = result.current.data?.[1];
    expect(first?.name).toBe("M1");
    expect(second?.name).toBe("M2");
  });

  it("passes filter as query parameters", async () => {
    const spy = server.mount(contract.macros.listMacros, { body: [] });

    const { result } = renderHook(() => useMacros({ search: "test", language: "python" }));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(spy.url).toContain("search=test");
    expect(spy.url).toContain("language=python");
  });
});
