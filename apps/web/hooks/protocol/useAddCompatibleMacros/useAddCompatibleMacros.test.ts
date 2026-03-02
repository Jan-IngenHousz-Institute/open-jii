import { tsr } from "@/lib/tsr";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useAddCompatibleMacros } from "./useAddCompatibleMacros";

vi.mock("@/lib/tsr", () => ({
  tsr: {
    useQueryClient: vi.fn(),
    protocols: {
      addCompatibleMacros: {
        useMutation: vi.fn(),
      },
    },
  },
}));

const mockTsr = vi.mocked(tsr, true);

describe("useAddCompatibleMacros", () => {
  const mockProtocolId = "test-protocol-id";
  const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined);
  let capturedOnSettled: ((...args: unknown[]) => Promise<void>) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnSettled = undefined;

    mockTsr.useQueryClient.mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    } as never);

    mockTsr.protocols.addCompatibleMacros.useMutation.mockImplementation(((opts: {
      onSettled: typeof capturedOnSettled;
    }) => {
      capturedOnSettled = opts.onSettled;
      return { mutateAsync: vi.fn(), isPending: false };
    }) as never);
  });

  it("should call useMutation with onSettled handler", () => {
    renderHook(() => useAddCompatibleMacros(mockProtocolId));

    expect(mockTsr.protocols.addCompatibleMacros.useMutation.mock.calls).toHaveLength(1);
    const call = mockTsr.protocols.addCompatibleMacros.useMutation.mock.calls[0]?.[0] as {
      onSettled?: unknown;
    };
    expect(typeof call.onSettled).toBe("function");
  });

  it("should return mutation result", () => {
    const { result } = renderHook(() => useAddCompatibleMacros(mockProtocolId));

    expect(result.current).toHaveProperty("mutateAsync");
    expect(result.current).toHaveProperty("isPending");
  });

  it("should invalidate correct query key on settled", async () => {
    renderHook(() => useAddCompatibleMacros(mockProtocolId));

    await capturedOnSettled?.();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["protocol-compatible-macros", mockProtocolId],
    });
  });

  it("should invalidate with different protocol IDs", async () => {
    const differentId = "other-protocol-id";
    renderHook(() => useAddCompatibleMacros(differentId));

    await capturedOnSettled?.();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["protocol-compatible-macros", differentId],
    });
  });
});
