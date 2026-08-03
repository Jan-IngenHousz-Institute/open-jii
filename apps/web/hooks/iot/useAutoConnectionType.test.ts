import { renderHook } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { useAutoConnectionType } from "./useAutoConnectionType";

describe("useAutoConnectionType", () => {
  it("selects serial when it is the only supported transport", () => {
    const setConnectionType = vi.fn();

    renderHook(() => useAutoConnectionType({ bluetooth: false, serial: true }, setConnectionType));

    expect(setConnectionType).toHaveBeenCalledWith("serial");
  });

  it("selects bluetooth when it is the only supported transport", () => {
    const setConnectionType = vi.fn();

    renderHook(() => useAutoConnectionType({ bluetooth: true, serial: false }, setConnectionType));

    expect(setConnectionType).toHaveBeenCalledWith("bluetooth");
  });

  it("leaves the selection alone when both or neither are supported", () => {
    const setConnectionType = vi.fn();

    renderHook(() => useAutoConnectionType({ bluetooth: true, serial: true }, setConnectionType));
    renderHook(() => useAutoConnectionType({ bluetooth: false, serial: false }, setConnectionType));

    expect(setConnectionType).not.toHaveBeenCalled();
  });
});
