import { createWorkbook } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api/contract";

import { useWorkbookList } from "./useWorkbookList";

describe("useWorkbookList", () => {
  it("returns workbooks from the API", async () => {
    const workbooks = [
      createWorkbook({ id: "wb-1", name: "First" }),
      createWorkbook({ id: "wb-2", name: "Second" }),
    ];

    server.mount(contract.workbooks.listWorkbooks, { body: workbooks });

    const { result } = renderHook(() => useWorkbookList());

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].name).toBe("First");
    });
  });

  it("returns loading state initially", () => {
    server.mount(contract.workbooks.listWorkbooks, { body: [] });

    const { result } = renderHook(() => useWorkbookList());

    expect(result.current.isLoading).toBe(true);
  });

  it("returns empty array when no workbooks exist", async () => {
    server.mount(contract.workbooks.listWorkbooks, { body: [] });

    const { result } = renderHook(() => useWorkbookList());

    await waitFor(() => {
      expect(result.current.data).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("returns error state on failure", async () => {
    server.mount(contract.workbooks.listWorkbooks, { status: 400 });

    const { result } = renderHook(() => useWorkbookList());

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });

  it("stops reporting searching as soon as the first response settles", async () => {
    server.mount(contract.workbooks.listWorkbooks, { body: [] });

    const { result } = renderHook(() => useWorkbookList());

    // Nothing is waiting to be searched on mount, so the debounce must not hold this
    // pending for its full window once an empty list has already come back.
    await waitFor(() => expect(result.current.data).toEqual([]));
    expect(result.current.isSearching).toBe(false);
  });

  it("sends the search term to the API", async () => {
    const spy = server.mount(contract.workbooks.listWorkbooks, { body: [] });

    renderHook(() => useWorkbookList({ search: "chlorophyll" }));

    await waitFor(() => expect(spy.calls.at(-1)?.query.search).toBe("chlorophyll"));
  });

  it("omits an empty or whitespace-only search so the full list is returned", async () => {
    const spy = server.mount(contract.workbooks.listWorkbooks, { body: [] });

    renderHook(() => useWorkbookList({ search: "   " }));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.calls.every((call) => !("search" in call.query))).toBe(true);
  });

  it("debounces so intermediate terms are never requested", async () => {
    const spy = server.mount(contract.workbooks.listWorkbooks, { body: [] });

    const { rerender } = renderHook(({ search }) => useWorkbookList({ search }), {
      initialProps: { search: "" },
    });
    await waitFor(() => expect(spy.called).toBe(true));

    for (const search of ["c", "ch", "chl", "chlo"]) rerender({ search });

    await waitFor(() => expect(spy.calls.at(-1)?.query.search).toBe("chlo"));
    const searches = spy.calls.map((call) => ("search" in call.query ? call.query.search : null));
    expect(searches).toEqual([null, "chlo"]);
  });

  it("keeps the previous results while the next search loads", async () => {
    const first = createWorkbook({ name: "First" });
    server.mount(contract.workbooks.listWorkbooks, { body: [first] });

    const { result, rerender } = renderHook(({ search }) => useWorkbookList({ search }), {
      initialProps: { search: "" },
    });
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    server.mount(contract.workbooks.listWorkbooks, { body: [], delay: 200 });
    rerender({ search: "nothing" });

    // Still the old page, flagged as searching, rather than an empty flash.
    await waitFor(() => expect(result.current.isSearching).toBe(true));
    expect(result.current.data).toHaveLength(1);

    await waitFor(() => expect(result.current.data).toEqual([]));
  });
});
