import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { StripShadowProvider, useIsStripShadow } from "./strip-shadow-context";

describe("StripShadowContext", () => {
  it("defaults to false outside any provider so live strip rows render the full popover", () => {
    const { result } = renderHook(() => useIsStripShadow());
    expect(result.current).toBe(false);
  });

  it("reports true inside a provider value={true}", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StripShadowProvider value={true}>{children}</StripShadowProvider>
    );
    const { result } = renderHook(() => useIsStripShadow(), { wrapper });
    expect(result.current).toBe(true);
  });

  it("respects an explicit value={false} override (e.g. nested live tree inside shadow)", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StripShadowProvider value={true}>
        <StripShadowProvider value={false}>{children}</StripShadowProvider>
      </StripShadowProvider>
    );
    const { result } = renderHook(() => useIsStripShadow(), { wrapper });
    expect(result.current).toBe(false);
  });
});
