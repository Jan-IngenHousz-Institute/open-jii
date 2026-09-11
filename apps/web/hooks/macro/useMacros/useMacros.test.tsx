import { createMacro } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, act, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useMacros } from "./useMacros";

const envelope = (items: unknown[], page = 1, totalPages = 1) => ({
  items,
  page,
  pageSize: 20,
  totalPages,
  totalCount: items.length,
});

describe("useMacros", () => {
  it("returns empty envelope by default", async () => {
    server.mount(contract.macros.listMacros, { body: envelope([]) });

    const { result } = renderHook(() => useMacros());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.items).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("returns macros list", async () => {
    server.mount(contract.macros.listMacros, {
      body: envelope([
        createMacro({ id: "1", name: "M1" }),
        createMacro({ id: "2", name: "M2", language: "javascript" }),
      ]),
    });

    const { result } = renderHook(() => useMacros());

    await waitFor(() => {
      expect(result.current.data?.items).toHaveLength(2);
    });

    const first = result.current.data?.items[0];
    const second = result.current.data?.items[1];
    expect(first?.name).toBe("M1");
    expect(second?.name).toBe("M2");
  });

  it("passes search and language as query parameters", async () => {
    const spy = server.mount(contract.macros.listMacros, { body: envelope([]) });

    const { result } = renderHook(() =>
      useMacros({ initialSearch: "test", initialLanguage: "python" }),
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(spy.calls[spy.calls.length - 1]?.query?.search).toBe("test");
    expect(spy.calls[spy.calls.length - 1]?.query?.language).toBe("python");
  });

  it("sends the current page as a query parameter", async () => {
    const spy = server.mount(contract.macros.listMacros, { body: envelope([], 1, 3) });

    const { result } = renderHook(() => useMacros());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(spy.calls[spy.calls.length - 1]?.query?.page).toBe("1");

    act(() => result.current.setPage(2));

    await waitFor(() => {
      expect(spy.calls[spy.calls.length - 1]?.query?.page).toBe("2");
    });
  });

  it("resets to page 1 when language changes", () => {
    server.mount(contract.macros.listMacros, { body: envelope([], 1, 3) });

    const { result } = renderHook(() => useMacros());

    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    act(() => result.current.setLanguage("r"));
    expect(result.current.page).toBe(1);
  });

  it("clamps the page when the result set shrinks below it", async () => {
    const spy = server.mount(contract.macros.listMacros, {
      body: envelope([], 1, 2),
    });

    const { result } = renderHook(() => useMacros());
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    act(() => result.current.setPage(3));

    await waitFor(() => {
      expect(result.current.page).toBe(2);
    });
    expect(spy.calls[spy.calls.length - 1]?.query?.page).toBe("2");
  });
});
