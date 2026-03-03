import { tsr } from "@/lib/tsr";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useRemoveCompatibleProtocol } from "./useRemoveCompatibleProtocol";

vi.mock("@/lib/tsr", () => ({
  tsr: {
    useQueryClient: vi.fn(),
    macros: {
      removeCompatibleProtocol: {
        useMutation: vi.fn(),
      },
    },
  },
}));

const mockTsr = vi.mocked(tsr, true);

describe("useRemoveCompatibleProtocol", () => {
  const mockMacroId = "test-macro-id";
  const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined);
  let capturedOnSettled: ((...args: unknown[]) => Promise<void>) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnSettled = undefined;

    mockTsr.useQueryClient.mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    } as never);

    mockTsr.macros.removeCompatibleProtocol.useMutation.mockImplementation(((opts: {
      onSettled: typeof capturedOnSettled;
    }) => {
      capturedOnSettled = opts.onSettled;
      return { mutateAsync: vi.fn(), isPending: false };
    }) as never);
  });

  it("should call useMutation with onSettled handler", () => {
    renderHook(() => useRemoveCompatibleProtocol(mockMacroId));

    expect(mockTsr.macros.removeCompatibleProtocol.useMutation.mock.calls).toHaveLength(1);
    const call = mockTsr.macros.removeCompatibleProtocol.useMutation.mock.calls[0]?.[0] as {
      onSettled?: unknown;
    };
    expect(typeof call.onSettled).toBe("function");
  });

  it("should return mutation result", () => {
    const { result } = renderHook(() => useRemoveCompatibleProtocol(mockMacroId));

    expect(result.current).toHaveProperty("mutateAsync");
    expect(result.current).toHaveProperty("isPending");
  });

  it("should invalidate correct query key on settled", async () => {
    renderHook(() => useRemoveCompatibleProtocol(mockMacroId));

    await capturedOnSettled?.();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["macro-compatible-protocols", mockMacroId],
    });
  });

  it("should invalidate with different macro IDs", async () => {
    const differentId = "other-macro-id";
    renderHook(() => useRemoveCompatibleProtocol(differentId));

    await capturedOnSettled?.();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["macro-compatible-protocols", differentId],
    });
  });
});
