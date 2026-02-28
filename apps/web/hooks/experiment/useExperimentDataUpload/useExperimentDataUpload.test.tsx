import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { useExperimentDataUpload } from "./useExperimentDataUpload";

describe("useExperimentDataUpload", () => {
  it("should send an upload request via MSW", async () => {
    const spy = server.mount(contract.experiments.uploadExperimentData, {
      body: { success: true, message: "Upload complete" },
      status: 201,
    });

    const { result } = renderHook(() => useExperimentDataUpload());

    act(() => {
      result.current.mutate({
        params: { id: "experiment-123" },
        body: { fileName: "data.csv", content: "csv-content" },
      });
    });

    await waitFor(() => expect(spy.called).toBe(true), { timeout: 3000 });
    expect(spy.calls[0].params).toEqual({ id: "experiment-123" });
  });

  it("should return mutation state (isPending, error)", () => {
    server.mount(contract.experiments.uploadExperimentData, {
      body: { success: true, message: "Upload complete" },
      status: 201,
    });

    const { result } = renderHook(() => useExperimentDataUpload());

    // Initially idle
    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should handle server error", async () => {
    server.mount(contract.experiments.uploadExperimentData, { status: 500 });

    const { result } = renderHook(() => useExperimentDataUpload());

    act(() => {
      result.current.mutate({
        params: { id: "experiment-123" },
        body: { fileName: "data.csv", content: "csv-content" },
      });
    });

    await waitFor(
      () => {
        expect(result.current.isPending).toBe(false);
        expect(result.current.error).not.toBeNull();
      },
      { timeout: 3000 },
    );
  });
});
