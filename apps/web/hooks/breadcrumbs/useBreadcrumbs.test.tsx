import { renderHook } from "@/test/test-utils";
import { usePathname } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { useBreadcrumbs } from "./useBreadcrumbs";

describe("useBreadcrumbs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the ancestor trail for the current pathname, synchronously", () => {
    vi.mocked(usePathname).mockReturnValue("/en/platform/experiments/exp-1");
    const { result } = renderHook(() => useBreadcrumbs("en"));
    expect(result.current).toEqual([
      { segment: "experiments", title: "experiments", href: "/en/platform/experiments" },
    ]);
  });

  it("returns an empty trail for a section root", () => {
    vi.mocked(usePathname).mockReturnValue("/en/platform/experiments");
    const { result } = renderHook(() => useBreadcrumbs("en"));
    expect(result.current).toEqual([]);
  });

  it("propagates the locale into hrefs", () => {
    vi.mocked(usePathname).mockReturnValue("/de/platform/experiments/new");
    const { result } = renderHook(() => useBreadcrumbs("de"));
    expect(result.current[0]?.href).toBe("/de/platform/experiments");
  });

  it("handles entity paths with UUIDs", () => {
    const uuid = "a1b2c3d4-e5f6-4890-abcd-ef1234567890";
    vi.mocked(usePathname).mockReturnValue(`/en/platform/experiments/${uuid}`);
    const { result } = renderHook(() => useBreadcrumbs("en"));
    expect(result.current).toEqual([
      { segment: "experiments", title: "experiments", href: "/en/platform/experiments" },
    ]);
  });
});
