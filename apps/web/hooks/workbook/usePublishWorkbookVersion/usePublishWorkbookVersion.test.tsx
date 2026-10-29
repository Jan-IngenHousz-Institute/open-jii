import { orpc } from "@/lib/orpc";
import { createWorkbookVersionSummary } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act, createTestQueryClient } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { toast } from "@repo/ui/hooks/use-toast";

import { usePublishWorkbookVersion } from "./usePublishWorkbookVersion";

const publishedVersion = {
  ...createWorkbookVersionSummary({ workbookId: "wb-1", version: 3 }),
  cells: [],
  metadata: {},
};

describe("usePublishWorkbookVersion", () => {
  it("publishes the workbook, toasts the new version and invokes onSuccess", async () => {
    const spy = server.mount(contract.workbooks.publishWorkbookVersion, { body: publishedVersion });
    const onSuccess = vi.fn();

    const { result } = renderHook(() => usePublishWorkbookVersion({ onSuccess }));

    act(() => {
      result.current.mutate({ id: "wb-1" });
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
    expect(spy.params).toMatchObject({ id: "wb-1" });
    expect((onSuccess.mock.calls[0][0] as { version: number }).version).toBe(3);
    expect(toast).toHaveBeenCalledWith({ description: "workbooks.versionPublished:3" });
  });

  it("toasts the failure and invokes onError when the API returns an error", async () => {
    server.mount(contract.workbooks.publishWorkbookVersion, { status: 403 });
    const onError = vi.fn();

    const { result } = renderHook(() => usePublishWorkbookVersion({ onError }));

    act(() => {
      result.current.mutate({ id: "wb-1" });
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });
    expect(toast).toHaveBeenCalledWith({
      description: "workbooks.publishVersionFailed",
      variant: "destructive",
    });
  });

  it("refetches the workbook and its versions once settled", async () => {
    server.mount(contract.workbooks.publishWorkbookVersion, { body: publishedVersion });
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => usePublishWorkbookVersion(), { queryClient });

    act(() => {
      result.current.mutate({ id: "wb-1" });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: orpc.workbooks.listWorkbookVersions.queryKey({ input: { id: "wb-1" } }),
        exact: true,
      });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: orpc.workbooks.getWorkbook.queryKey({ input: { id: "wb-1" } }),
      exact: true,
    });
  });
});
