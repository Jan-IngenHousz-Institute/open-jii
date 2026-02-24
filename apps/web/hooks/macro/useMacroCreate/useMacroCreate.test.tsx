/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderHook } from "@/test/test-utils";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { useMacroCreate } from "./useMacroCreate";

const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined);
const mockUseMutation = vi.fn();

vi.mock("@/lib/tsr", () => ({
  tsr: {
    useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
    macros: {
      createMacro: {
        useMutation: (...args: unknown[]) => mockUseMutation(...args),
      },
    },
  },
}));

describe("useMacroCreate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("registers onSuccess and onError callbacks", () => {
    mockUseMutation.mockReturnValue({ mutate: vi.fn() });
    renderHook(() => useMacroCreate());

    expect(mockUseMutation).toHaveBeenCalledWith({
      onSuccess: expect.any(Function),
      onError: expect.any(Function),
    });
  });

  it("onSuccess invalidates macros and calls option callback", () => {
    const onSuccess = vi.fn();
    mockUseMutation.mockImplementation((opts: any) => {
      opts.onSuccess({ body: { id: "macro-1" } });
      return { mutate: vi.fn() };
    });

    renderHook(() => useMacroCreate({ onSuccess }));

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["macros"] });
    expect(onSuccess).toHaveBeenCalledWith("macro-1");
  });

  it("onError calls option callback", () => {
    const onError = vi.fn();
    const error = new Error("fail");
    mockUseMutation.mockImplementation((opts: any) => {
      opts.onError(error);
      return { mutate: vi.fn() };
    });

    renderHook(() => useMacroCreate({ onError }));

    expect(onError).toHaveBeenCalledWith(error);
  });
});
