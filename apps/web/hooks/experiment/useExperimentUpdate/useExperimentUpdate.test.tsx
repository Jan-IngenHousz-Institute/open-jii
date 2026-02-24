/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
import { renderHook } from "@/test/test-utils";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { useExperimentUpdate } from "./useExperimentUpdate";

const mockCancelQueries = vi.fn().mockResolvedValue(undefined);
const mockGetQueryData = vi.fn();
const mockSetQueryData = vi.fn();
const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined);
const mockUseMutation = vi.fn();

vi.mock("@/lib/tsr", () => ({
  tsr: {
    useQueryClient: () => ({
      cancelQueries: mockCancelQueries,
      getQueryData: mockGetQueryData,
      setQueryData: mockSetQueryData,
      invalidateQueries: mockInvalidateQueries,
    }),
    experiments: {
      updateExperiment: {
        useMutation: (...args: unknown[]) => mockUseMutation(...args),
      },
    },
  },
}));

describe("useExperimentUpdate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("registers mutation with onMutate, onError, onSettled", () => {
    mockUseMutation.mockReturnValue({ mutate: vi.fn() });
    renderHook(() => useExperimentUpdate());

    expect(mockUseMutation).toHaveBeenCalledWith({
      onMutate: expect.any(Function),
      onError: expect.any(Function),
      onSettled: expect.any(Function),
    });
  });

  it("onMutate optimistically updates caches", async () => {
    const prev = { body: { id: "exp-1", name: "Old" } };
    mockGetQueryData.mockImplementation((key: any) => (key[0] === "experiment" ? prev : undefined));
    mockUseMutation.mockImplementation((opts: any) => {
      // store callbacks so we can call them
      (useExperimentUpdate as any).__opts = opts;
      return { mutate: vi.fn() };
    });

    renderHook(() => useExperimentUpdate());

    const opts = (useExperimentUpdate as any).__opts;
    await opts.onMutate({ params: { id: "exp-1" }, body: { name: "New" } });

    expect(mockCancelQueries).toHaveBeenCalledWith({ queryKey: ["experiment", "exp-1"] });
    expect(mockSetQueryData).toHaveBeenCalledWith(["experiment", "exp-1"], {
      body: { id: "exp-1", name: "New" },
    });
  });

  it("onError reverts caches", () => {
    mockUseMutation.mockImplementation((opts: any) => {
      (useExperimentUpdate as any).__opts = opts;
      return { mutate: vi.fn() };
    });

    renderHook(() => useExperimentUpdate());

    const opts = (useExperimentUpdate as any).__opts;
    const context = { previousExperiment: { body: { id: "exp-1", name: "Old" } } };
    opts.onError(new Error("fail"), { params: { id: "exp-1" } }, context);

    expect(mockSetQueryData).toHaveBeenCalledWith(
      ["experiment", "exp-1"],
      context.previousExperiment,
    );
  });

  it("onSettled invalidates all related queries", async () => {
    mockUseMutation.mockImplementation((opts: any) => {
      (useExperimentUpdate as any).__opts = opts;
      return { mutate: vi.fn() };
    });

    renderHook(() => useExperimentUpdate());

    const opts = (useExperimentUpdate as any).__opts;
    await opts.onSettled(undefined, undefined, { params: { id: "exp-1" } });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["experiment", "exp-1"],
      exact: true,
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["experimentAccess", "exp-1"] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["experiments"] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["breadcrumbs"] });
  });
});
