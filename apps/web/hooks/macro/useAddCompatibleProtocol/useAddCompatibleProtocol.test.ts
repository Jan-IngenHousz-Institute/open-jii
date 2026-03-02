import { tsr } from "@/lib/tsr";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useAddCompatibleProtocol } from "./useAddCompatibleProtocol";

vi.mock("@/lib/tsr", () => ({
  tsr: {
    useQueryClient: vi.fn(),
    macros: {
      addCompatibleProtocols: {
        useMutation: vi.fn(),
      },
    },
  },
}));

const mockTsr = vi.mocked(tsr, true);

describe("useAddCompatibleProtocol", () => {
  const mockMacroId = "test-macro-id";
  const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined);
  let capturedOnSettled: ((...args: unknown[]) => Promise<void>) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnSettled = undefined;

    mockTsr.useQueryClient.mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    } as never);

    mockTsr.macros.addCompatibleProtocols.useMutation.mockImplementation(((opts: {
      onSettled: typeof capturedOnSettled;
    }) => {
      capturedOnSettled = opts.onSettled;
      return { mutateAsync: vi.fn(), isPending: false };
    }) as never);
  });

  it("should call useMutation with onSettled handler", () => {
    renderHook(() => useAddCompatibleProtocol(mockMacroId));

    expect(mockTsr.macros.addCompatibleProtocols.useMutation.mock.calls).toHaveLength(1);
    const call = mockTsr.macros.addCompatibleProtocols.useMutation.mock.calls[0]?.[0] as {
      onSettled?: unknown;
    };
    expect(typeof call.onSettled).toBe("function");
  });

  it("should return mutation result", () => {
    const { result } = renderHook(() => useAddCompatibleProtocol(mockMacroId));

    expect(result.current).toHaveProperty("mutateAsync");
    expect(result.current).toHaveProperty("isPending");
  });

  it("should invalidate correct query key on settled", async () => {
    renderHook(() => useAddCompatibleProtocol(mockMacroId));

    await capturedOnSettled?.();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["macro-compatible-protocols", mockMacroId],
    });
  });

  it("should invalidate with different macro IDs", async () => {
    const differentId = "other-macro-id";
    renderHook(() => useAddCompatibleProtocol(differentId));

    await capturedOnSettled?.();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["macro-compatible-protocols", differentId],
    });
  });
});
