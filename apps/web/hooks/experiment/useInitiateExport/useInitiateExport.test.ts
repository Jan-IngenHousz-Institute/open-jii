import { tsr } from "@/lib/tsr";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useInitiateExport } from "./useInitiateExport";

vi.mock("@/lib/tsr", () => ({
  tsr: {
    useQueryClient: vi.fn(),
    experiments: {
      initiateExport: {
        useMutation: vi.fn(),
      },
    },
  },
}));

const mockTsr = vi.mocked(tsr, true);

describe("useInitiateExport", () => {
  const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined);
  let capturedOnSuccess: ((...args: unknown[]) => Promise<void>) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnSuccess = undefined;

    mockTsr.useQueryClient.mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    } as never);

    mockTsr.experiments.initiateExport.useMutation.mockImplementation(((opts: {
      onSuccess: typeof capturedOnSuccess;
    }) => {
      capturedOnSuccess = opts.onSuccess;
      return { mutate: vi.fn(), isPending: false };
    }) as never);
  });

  it("should call useMutation with onSuccess handler", () => {
    renderHook(() => useInitiateExport());

    const call = mockTsr.experiments.initiateExport.useMutation.mock.calls[0]?.[0] as {
      onSuccess?: unknown;
    };
    expect(typeof call.onSuccess).toBe("function");
  });

  it("should return mutation result", () => {
    const { result } = renderHook(() => useInitiateExport());

    expect(result.current).toHaveProperty("mutate");
  });

  it("should invalidate exports queries on success", async () => {
    renderHook(() => useInitiateExport());

    await capturedOnSuccess?.(
      { body: { exportId: "export-456" } },
      { params: { id: "exp-123" }, body: { tableName: "raw_data", format: "csv" } },
    );

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["exports", "exp-123", "raw_data"],
      refetchType: "all",
    });
  });

  it("should invalidate queries for different table names", async () => {
    renderHook(() => useInitiateExport());

    await capturedOnSuccess?.(
      { body: { exportId: "export-789" } },
      { params: { id: "exp-123" }, body: { tableName: "device", format: "ndjson" } },
    );

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["exports", "exp-123", "device"],
      refetchType: "all",
    });
  });

  it("should call custom onSuccess after invalidating queries", async () => {
    const mockCustomOnSuccess = vi.fn();

    renderHook(() => useInitiateExport({ onSuccess: mockCustomOnSuccess }));

    await capturedOnSuccess?.(
      { body: { exportId: "export-456" } },
      { params: { id: "exp-123" }, body: { tableName: "raw_data", format: "csv" } },
    );

    expect(mockInvalidateQueries).toHaveBeenCalled();
    expect(mockCustomOnSuccess).toHaveBeenCalled();
  });

  it("should not throw when custom onSuccess is not provided", async () => {
    renderHook(() => useInitiateExport());

    await expect(
      capturedOnSuccess?.(
        { body: { exportId: "export-999" } },
        { params: { id: "exp-123" }, body: { tableName: "raw_data", format: "parquet" } },
      ),
    ).resolves.toBeUndefined();
  });
});
