import { createUpload } from "@/test/factories";
import { server } from "@/test/msw/server";
import { act, renderHook, waitFor } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useListUploads } from "./useListUploads";

describe("useListUploads", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the upload list when enabled", async () => {
    const running = createUpload({ status: "running" });
    const completed = createUpload({ status: "completed" });
    server.mount(contract.experiments.listUploads, { body: { uploads: [running, completed] } });

    const { result } = renderHook(() => useListUploads("exp-1", { enabled: true }));

    await waitFor(() => {
      expect(result.current.data?.uploads).toHaveLength(2);
    });
    expect(result.current.data?.uploads[0].uploadId).toBe(running.uploadId);
  });

  it("does not fetch when disabled", () => {
    const spy = server.mount(contract.experiments.listUploads, { body: { uploads: [] } });

    const { result } = renderHook(() => useListUploads("exp-1", { enabled: false }));

    expect(result.current.data).toBeUndefined();
    expect(spy.callCount).toBe(0);
  });

  it("forwards the uploadTableName filter to the request", async () => {
    const spy = server.mount(contract.experiments.listUploads, { body: { uploads: [] } });

    renderHook(() => useListUploads("exp-1", { uploadTableName: "leaf_traits", enabled: true }));

    await waitFor(() => {
      expect(spy.callCount).toBeGreaterThanOrEqual(1);
    });
    expect(spy.calls[0].query.uploadTableName).toBe("leaf_traits");
  });

  it("polls while an upload is unfinished and stops once every upload finished", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const receiving = createUpload({ status: "receiving" });
    const completed = createUpload({ ...receiving, status: "completed" });
    const spy = server.mount(contract.experiments.listUploads, {
      body: () => ({ uploads: [spy.callCount > 1 ? completed : receiving] }),
    });

    const { result } = renderHook(() => useListUploads("exp-1", { enabled: true }));
    await waitFor(() => expect(result.current.data?.uploads[0]?.status).toBe("receiving"));

    await act(() => vi.advanceTimersByTimeAsync(15_000));
    await waitFor(() => expect(result.current.data?.uploads[0]?.status).toBe("completed"));
    const callsWhenFinished = spy.callCount;

    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(spy.callCount).toBe(callsWhenFinished);
  });

  it("does not poll when every upload has finished", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const spy = server.mount(contract.experiments.listUploads, {
      body: {
        uploads: [
          createUpload({ status: "completed" }),
          createUpload({ status: "failed", errorCode: "no_rows" }),
        ],
      },
    });

    const { result } = renderHook(() => useListUploads("exp-1", { enabled: true }));
    await waitFor(() => expect(result.current.data?.uploads).toHaveLength(2));

    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(spy.callCount).toBe(1);
  });
});
