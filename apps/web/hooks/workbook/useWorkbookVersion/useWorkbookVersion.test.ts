import { createWorkbookVersionSummary } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";

import { useWorkbookVersion } from "./useWorkbookVersion";

const workbookId = "wb-1";
const versionId = "ver-1";

const versionBody = {
  ...createWorkbookVersionSummary({ id: versionId, workbookId }),
  cells: [],
  metadata: {},
  entitySnapshots: { protocols: {}, macros: {} },
};

describe("useWorkbookVersion", () => {
  beforeEach(() => {
    server.mount(contract.workbooks.getWorkbookVersion, { body: versionBody });
  });

  it("fetches a specific workbook version", async () => {
    const { result } = renderHook(() => useWorkbookVersion(workbookId, versionId));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual(versionBody);
    expect(result.current.error).toBeNull();
  });

  it("is disabled when workbookId is empty", () => {
    const { result } = renderHook(() => useWorkbookVersion("", versionId));

    expect(result.current.data).toBeUndefined();
  });

  it("is disabled when versionId is empty", () => {
    const { result } = renderHook(() => useWorkbookVersion(workbookId, ""));

    expect(result.current.data).toBeUndefined();
  });

  it("respects explicit enabled: false", () => {
    const { result } = renderHook(() =>
      useWorkbookVersion(workbookId, versionId, { enabled: false }),
    );

    expect(result.current.data).toBeUndefined();
  });

  it("holds the previous version while a new versionId loads", async () => {
    const { result, rerender } = renderHook(
      ({ v }: { v: string }) => useWorkbookVersion(workbookId, v),
      { initialProps: { v: versionId } },
    );

    await waitFor(() => expect(result.current.data).toEqual(versionBody));

    const nextBody = {
      ...createWorkbookVersionSummary({ id: "ver-2", workbookId, version: 2 }),
      cells: [],
      metadata: {},
      entitySnapshots: { protocols: {}, macros: {} },
    };
    server.mount(contract.workbooks.getWorkbookVersion, { body: nextBody });
    rerender({ v: "ver-2" });

    // Re-pinning must not drop callers to a loading state (OJD-1723).
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual(versionBody);

    await waitFor(() => expect(result.current.data).toEqual(nextBody));
  });

  it("drops the placeholder when the workbook changes", async () => {
    const { result, rerender } = renderHook(
      ({ w }: { w: string }) => useWorkbookVersion(w, versionId),
      { initialProps: { w: workbookId } },
    );

    await waitFor(() => expect(result.current.data).toEqual(versionBody));

    server.mount(contract.workbooks.getWorkbookVersion, {
      body: {
        ...createWorkbookVersionSummary({ id: "ver-9", workbookId: "wb-2" }),
        cells: [],
        metadata: {},
        entitySnapshots: { protocols: {}, macros: {} },
      },
    });
    rerender({ w: "wb-2" });

    // Another workbook's cells must never be shown as this one's.
    expect(result.current.data).toBeUndefined();
  });

  it("returns error on API failure", async () => {
    server.mount(contract.workbooks.getWorkbookVersion, { status: 500 });

    const { result } = renderHook(() => useWorkbookVersion(workbookId, versionId));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
  });
});
