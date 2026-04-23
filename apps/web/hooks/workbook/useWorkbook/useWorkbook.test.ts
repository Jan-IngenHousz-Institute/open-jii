import { createWorkbook } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { useWorkbook } from "./useWorkbook";

describe("useWorkbook", () => {
  it("returns a workbook by id", async () => {
    const workbook = createWorkbook({ id: "wb-1", name: "My Workbook" });
    server.mount(contract.workbooks.getWorkbook, { body: workbook });

    const { result } = renderHook(() => useWorkbook("wb-1"));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.name).toBe("My Workbook");
    });
  });

  it("shows loading state initially", () => {
    server.mount(contract.workbooks.getWorkbook, { body: createWorkbook() });

    const { result } = renderHook(() => useWorkbook("wb-1"));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("returns undefined data when disabled", () => {
    server.mount(contract.workbooks.getWorkbook, { body: createWorkbook() });

    const { result } = renderHook(() => useWorkbook("wb-1", { enabled: false }));

    // Should not fetch when disabled
    expect(result.current.data).toBeUndefined();
  });

  it("returns undefined data when id is empty", () => {
    server.mount(contract.workbooks.getWorkbook, { body: createWorkbook() });

    const { result } = renderHook(() => useWorkbook(""));

    // Empty id disables the query
    expect(result.current.data).toBeUndefined();
  });

  it("returns error state on failure", async () => {
    server.mount(contract.workbooks.getWorkbook, { status: 404 });

    const { result } = renderHook(() => useWorkbook("wb-missing"));

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });
});
