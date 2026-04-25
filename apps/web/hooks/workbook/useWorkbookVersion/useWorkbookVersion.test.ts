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

  it("returns error on API failure", async () => {
    server.mount(contract.workbooks.getWorkbookVersion, { status: 500 });

    const { result } = renderHook(() => useWorkbookVersion(workbookId, versionId));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
  });
});
