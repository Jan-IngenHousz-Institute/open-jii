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
});
