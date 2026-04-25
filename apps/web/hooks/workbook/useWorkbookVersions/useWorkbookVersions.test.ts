import { createWorkbookVersionSummary } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api/contract";

import { useWorkbookVersions } from "./useWorkbookVersions";

const workbookId = "11111111-1111-1111-1111-111111111111";

describe("useWorkbookVersions", () => {
  it("returns versions for a workbook", async () => {
    server.mount(contract.workbooks.listWorkbookVersions, {
      body: [
        createWorkbookVersionSummary({ workbookId, version: 2 }),
        createWorkbookVersionSummary({ workbookId, version: 1 }),
      ],
    });

    const { result } = renderHook(() => useWorkbookVersions(workbookId));

    await waitFor(() => {
      expect(result.current.data?.body).toHaveLength(2);
      expect(result.current.data?.body[0].version).toBe(2);
    });
  });

  it("returns empty array when no versions exist", async () => {
    server.mount(contract.workbooks.listWorkbookVersions, { body: [] });

    const { result } = renderHook(() => useWorkbookVersions(workbookId));

    await waitFor(() => {
      expect(result.current.data?.body).toEqual([]);
    });
  });

  it("handles loading state", () => {
    server.mount(contract.workbooks.listWorkbookVersions, { body: [], delay: 999_999 });

    const { result } = renderHook(() => useWorkbookVersions(workbookId));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("does not fetch when disabled", () => {
    const { result } = renderHook(() => useWorkbookVersions(workbookId, { enabled: false }));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it("handles error state", async () => {
    server.mount(contract.workbooks.listWorkbookVersions, { status: 500 });

    const { result } = renderHook(() => useWorkbookVersions(workbookId));

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });
});
