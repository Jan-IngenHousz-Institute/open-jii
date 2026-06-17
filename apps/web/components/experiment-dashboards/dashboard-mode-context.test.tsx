import { act, renderHook } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { DashboardModeProvider, useDashboardMode } from "./dashboard-mode-context";

function wrap(initialMode?: "view" | "edit") {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <DashboardModeProvider initialMode={initialMode}>{children}</DashboardModeProvider>;
  };
}

describe("DashboardModeProvider / useDashboardMode", () => {
  it("defaults to view mode when no initialMode is provided", () => {
    const { result } = renderHook(() => useDashboardMode(), { wrapper: wrap() });
    expect(result.current.mode).toBe("view");
  });

  it("respects the initialMode prop", () => {
    const { result } = renderHook(() => useDashboardMode(), { wrapper: wrap("edit") });
    expect(result.current.mode).toBe("edit");
  });

  it("setMode replaces the current mode", () => {
    const { result } = renderHook(() => useDashboardMode(), { wrapper: wrap("view") });
    act(() => result.current.setMode("edit"));
    expect(result.current.mode).toBe("edit");
  });

  it("toggleMode flips between view and edit", () => {
    const { result } = renderHook(() => useDashboardMode(), { wrapper: wrap("view") });
    act(() => result.current.toggleMode());
    expect(result.current.mode).toBe("edit");
    act(() => result.current.toggleMode());
    expect(result.current.mode).toBe("view");
  });

  it("throws when used outside a provider", () => {
    const orig = console.error;
    console.error = () => {
      /* silence React's expected error log */
    };
    try {
      expect(() => renderHook(() => useDashboardMode())).toThrow(
        /must be used inside DashboardModeProvider/,
      );
    } finally {
      console.error = orig;
    }
  });
});
