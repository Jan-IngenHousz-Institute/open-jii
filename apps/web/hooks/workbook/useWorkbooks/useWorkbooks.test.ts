import { createWorkbook } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, act, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api/contract";

import { useWorkbooks } from "./useWorkbooks";

const envelope = (items: unknown[], page = 1, totalPages = 1) => ({
  items,
  page,
  pageSize: 20,
  totalPages,
  totalCount: items.length,
});

describe("useWorkbooks", () => {
  it("returns workbooks from the API", async () => {
    const workbooks = [createWorkbook({ id: "wb-1", name: "Mine" })];
    server.mount(contract.workbooks.listWorkbooksPaginated, { body: envelope(workbooks) });

    const { result } = renderHook(() => useWorkbooks());

    await waitFor(() => {
      expect(result.current.data?.items).toHaveLength(1);
      expect(result.current.data?.items[0].name).toBe("Mine");
    });
  });

  it("shows loading state initially", () => {
    server.mount(contract.workbooks.listWorkbooksPaginated, { body: envelope([]) });

    const { result } = renderHook(() => useWorkbooks());

    expect(result.current.isLoading).toBe(true);
  });

  it("sends the current page as a query parameter", async () => {
    const spy = server.mount(contract.workbooks.listWorkbooksPaginated, {
      body: envelope([], 1, 3),
    });

    const { result } = renderHook(() => useWorkbooks());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(spy.calls[spy.calls.length - 1]?.query?.page).toBe("1");

    act(() => result.current.setPage(2));

    await waitFor(() => {
      expect(spy.calls[spy.calls.length - 1]?.query?.page).toBe("2");
    });
  });

  it("resets to page 1 when search changes", () => {
    server.mount(contract.workbooks.listWorkbooksPaginated, { body: envelope([], 1, 3) });

    const { result } = renderHook(() => useWorkbooks());

    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);

    act(() => result.current.setSearch("wheat"));
    expect(result.current.page).toBe(1);
  });

  it("clamps the page when the result set shrinks below it", async () => {
    const spy = server.mount(contract.workbooks.listWorkbooksPaginated, {
      body: envelope([], 1, 2),
    });

    const { result } = renderHook(() => useWorkbooks());
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    act(() => result.current.setPage(3));

    await waitFor(() => {
      expect(result.current.page).toBe(2);
    });
    expect(spy.calls[spy.calls.length - 1]?.query?.page).toBe("2");
  });

  it("provides search and setSearch", () => {
    server.mount(contract.workbooks.listWorkbooksPaginated, { body: envelope([]) });

    const { result } = renderHook(() => useWorkbooks());

    expect(result.current.search).toBe("");
    expect(typeof result.current.setSearch).toBe("function");
  });

  it("returns error state on API failure", async () => {
    server.mount(contract.workbooks.listWorkbooksPaginated, { status: 400 });

    const { result } = renderHook(() => useWorkbooks());

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });
});
